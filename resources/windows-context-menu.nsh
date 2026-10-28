!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\Shumora" "" "Open in Shumora"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\Shumora" "Icon" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\Shumora\command" "" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --open-folder $\"%1$\"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Shumora" "" "Open in Shumora"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Shumora" "Icon" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Shumora\command" "" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --open-folder $\"%V$\"'
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\shell\Shumora"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Shumora"
!macroend
