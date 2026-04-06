!include LogicLib.nsh
!include WinMessages.nsh

Var SplashHwnd

!macro customHeader
  !system "echo !define NSIS_PACKEDVERSION 1 > ${BUILD_RESOURCES_DIR}\packed.nsh"
!macroend

; Para oneClick, usamos customInit que se ejecuta muy temprano
!macro customInit
  SetShellVarContext current

  ; Crear ventana de splash/espera
  Banner::show /NOUNLOAD /set 76,1,,1,1 "Actualizando ERP-aio..." "Por favor espere mientras se instala la actualización..."

  ; Cerrar proceso ERP-aio.exe de forma agresiva
  nsExec::ExecToStack 'taskkill /F /IM "ERP-aio.exe" /T'
  Pop $0
  Pop $1

  ; También cerrar procesos relacionados
  nsExec::ExecToStack 'taskkill /F /IM "electron.exe" /T'
  Pop $0
  Pop $1

  ; Esperar 3 segundos para asegurar que los procesos se cierren
  Sleep 3000

  ; Verificar si el directorio existe y renombrarlo
  IfFileExists "$INSTDIR\*.*" 0 dir_not_exists
    ; Renombrar directorio antiguo
    Rename "$INSTDIR" "$INSTDIR.old"
    IfFileExists "$INSTDIR.old\*.*" 0 rename_failed
      ; Programar eliminación al reiniciar
      Delete /REBOOTOK "$INSTDIR.old\*.*"
      RMDir /r /REBOOTOK "$INSTDIR.old"
      Goto dir_done

    rename_failed:
      ; Intentar eliminar directamente
      Delete /REBOOTOK "$INSTDIR\*.*"
      RMDir /r /REBOOTOK "$INSTDIR"
      Goto dir_done

  dir_not_exists:

  dir_done:
!macroend

!macro customInstall
  SetShellVarContext current

  ; Cerrar el banner de espera
  Banner::destroy

  ; Instalación completada - la app se abrirá automáticamente (runAfterFinish: true)
!macroend
