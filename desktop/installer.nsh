!macro customInit
  nsExec::ExecToLog 'taskkill /T /IM "VEDA Desktop.exe"'
  Pop $0
  Sleep 2000
  nsExec::ExecToLog 'taskkill /F /T /IM "VEDA Desktop.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "VEDA-Agent.exe"'
  Pop $0
!macroend
