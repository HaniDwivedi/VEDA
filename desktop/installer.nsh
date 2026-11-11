!macro customCheckAppRunning
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /T /IM "VEDA-Agent.exe"'
  Pop $0
  Sleep 2000
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM "VEDA-Agent.exe"'
  Pop $0
  Sleep 1000
  !insertmacro _CHECK_APP_RUNNING
!macroend
