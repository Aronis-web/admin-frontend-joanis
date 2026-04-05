const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function createIcon() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const outputDir = path.join(__dirname, 'electron', 'build');
    const outputPath = path.join(outputDir, 'icon.ico');

    // Crear directorio build si no existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // También copiar el PNG para otras plataformas
    fs.copyFileSync(iconPath, path.join(outputDir, 'icon.png'));
    console.log('✓ Icono PNG copiado a electron/build/icon.png');

    // Crear .ico para Windows
    // Verificar cómo está exportada la función
    const convertFn = pngToIco.default || pngToIco;
    const buf = await convertFn(iconPath);
    fs.writeFileSync(outputPath, buf);
    console.log('✓ Icono .ico creado exitosamente en electron/build/icon.ico');
  } catch (error) {
    console.error('Error al crear el icono:', error);
    process.exit(1);
  }
}

createIcon();
