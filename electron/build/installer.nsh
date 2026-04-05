!macro customInit
  ; Cerrar la aplicación si está ejecutándose
  DetailPrint "Cerrando ERP-aio si está en ejecución..."

  ; Intentar cerrar múltiples veces para asegurar que se cierre
  nsExec::Exec 'taskkill /F /IM ERP-aio.exe /T'
  Pop $0
  Sleep 1000

  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  Pop $0
  Sleep 1000

  ; Segundo intento
  nsExec::Exec 'taskkill /F /IM ERP-aio.exe /T'
  Pop $0
  Sleep 1000

  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  Pop $0
  Sleep 2000

  DetailPrint "Preparando instalación..."
!macroend

!macro customInstall
  ; Después de instalar, limpiar archivos antiguos si existen
  DetailPrint "Limpiando archivos antiguos..."

  ; Eliminar instalaciones antiguas en otras ubicaciones
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\ERP-aio\ERP-aio.exe"
    ${If} "$INSTDIR" != "$LOCALAPPDATA\Programs\ERP-aio"
      RMDir /r "$LOCALAPPDATA\Programs\ERP-aio"
    ${EndIf}
  ${EndIf}

  ${If} ${FileExists} "$PROGRAMFILES\ERP-aio\ERP-aio.exe"
    ${If} "$INSTDIR" != "$PROGRAMFILES\ERP-aio"
      RMDir /r "$PROGRAMFILES\ERP-aio"
    ${EndIf}
  ${EndIf}
!macroend
