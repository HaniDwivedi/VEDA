!macro vedaCheckProcess IMAGE RETURN
  nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "IMAGENAME eq ${IMAGE}" /FO TABLE /NH | "$SYSDIR\findstr.exe" /B /I /C:"${IMAGE}"`
  Pop ${RETURN}
!macroend

!macro vedaStopProcess IMAGE
  nsExec::ExecToLog `"$SYSDIR\taskkill.exe" /T /IM "${IMAGE}"`
  Pop $0
  Sleep 2000
  !insertmacro vedaCheckProcess "${IMAGE}" $0
  ${if} $0 == 0
    nsExec::ExecToLog `"$SYSDIR\taskkill.exe" /F /T /IM "${IMAGE}"`
    Pop $0
    Sleep 1000
    !insertmacro vedaCheckProcess "${IMAGE}" $0
    ${if} $0 == 0
      MessageBox MB_OK|MB_ICONSTOP `Could not close "${IMAGE}". If it is running as administrator, run this installer as administrator and try again.`
      Quit
    ${endIf}
  ${endIf}
!macroend

!macro customCheckAppRunning
  !insertmacro vedaStopProcess "${APP_EXECUTABLE_FILENAME}"
  !insertmacro vedaStopProcess "VEDA-Agent.exe"
!macroend
