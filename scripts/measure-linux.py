#!/usr/bin/env python3
"""Measure an isolated, empty-workspace production build without debug flags.

Run `npx electron-vite build` first. Requires Linux /proc and a working display.
Results are observations, not a benchmark of active agents or Windows.
"""
import argparse
import json
import os
from pathlib import Path
import statistics
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--seconds', type=int, default=30)
parser.add_argument('--output', default='/tmp/shumora-production-performance.json')
args = parser.parse_args()
if args.seconds < 5:
    parser.error('--seconds must be at least 5')
repo = Path(__file__).resolve().parent.parent
hz = os.sysconf('SC_CLK_TCK')
page = os.sysconf('SC_PAGE_SIZE')


def processes():
    result = {}
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            fields = (entry / 'stat').read_text().rsplit(')', 1)[1].split()
            result[int(entry.name)] = dict(ppid=int(fields[1]), ticks=int(fields[11]) + int(fields[12]), rss=int(fields[21]) * page)
        except (OSError, ValueError, ProcessLookupError):
            pass
    return result


def tree(all_processes, root):
    ids = {root}
    while True:
        children = {pid for pid, item in all_processes.items() if item['ppid'] in ids}
        if children <= ids:
            return ids & all_processes.keys()
        ids |= children


with tempfile.TemporaryDirectory(prefix='shumora-performance-') as profile:
    Path(profile, 'workspace-terminals.json').write_text('[]')
    env = {k: v for k, v in os.environ.items() if k not in ('ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL')}
    with open('/tmp/shumora-performance-launch.log', 'w') as log:
        app = subprocess.Popen([str(repo / 'node_modules/electron/dist/electron'), '--user-data-dir=' + profile, '.'], cwd=repo, env=env, stdout=log, stderr=log)
        try:
            # Allow initial loading and plugin detection to settle; don't call this UI startup time.
            time.sleep(10)
            if app.poll() is not None:
                raise RuntimeError('Electron exited; inspect /tmp/shumora-performance-launch.log')
            previous = processes()
            last = time.monotonic()
            samples = []
            for _ in range(args.seconds):
                time.sleep(1)
                current = processes()
                now = time.monotonic()
                ids = tree(current, app.pid)
                if app.poll() is not None:
                    raise RuntimeError('Electron exited during sampling')
                pss = 0
                for pid in ids:
                    try:
                        for line in Path(f'/proc/{pid}/smaps_rollup').read_text().splitlines():
                            if line.startswith('Pss:'):
                                pss += int(line.split()[1]) * 1024
                    except OSError:
                        pass
                samples.append(dict(processes=len(ids), rss_MiB=sum(current[p]['rss'] for p in ids) / 1048576, pss_MiB=pss / 1048576, cpu_one_core_pct=sum(max(0, current[p]['ticks'] - previous.get(p, current[p])['ticks']) for p in ids) / hz / (now - last) * 100))
                previous, last = current, now
            report = dict(scenario='production build, fresh profile, empty workspace, no agents, 10s warmup', kernel=os.uname().release, logical_cpus=os.cpu_count(), samples=samples, mean={key: statistics.mean(row[key] for row in samples) for key in ('rss_MiB', 'pss_MiB', 'cpu_one_core_pct')})
            Path(args.output).write_text(json.dumps(report, indent=2) + '\n')
            print(json.dumps(report['mean'], indent=2))
            print('Saved:', args.output)
        finally:
            # Only our empty-profile instance is terminated; never touch existing user instances.
            app.terminate()
            try:
                app.wait(timeout=10)
            except subprocess.TimeoutExpired:
                app.kill()
                app.wait()
