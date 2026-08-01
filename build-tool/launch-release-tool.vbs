' Lanza la app ERP-aio Release Tool sin ventana de consola.
Dim sh, fso, projectDir
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Carpeta del proyecto (padre de build-tool)
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = projectDir

' Ejecuta electron sobre build-tool/main.js en modo oculto (0), sin esperar (False)
sh.Run "cmd /c npx electron build-tool\main.js", 0, False
