# Veintiuno · Training Log

PWA estática para seguir el plan de las medias maratones de Valencia y Sevilla 2026.

## Funciones

- Plan completo de 86 entradas.
- Vista del entrenamiento del día y de la semana.
- Tipos de entrenamiento tomados directamente del plan.
- Reorganización de sesiones dentro de una misma semana.
- Registro de resultados, esfuerzo y sensaciones.
- Progreso semanal.
- Datos guardados exclusivamente en el navegador mediante `localStorage`.
- Funcionamiento sin conexión después de la primera visita.

## Desarrollo local

Requiere Node.js 22 o posterior.

```bash
npm install
npm run dev
```

La compilación de producción se genera con:

```bash
npm run build
```

## Actualizar la planificación

Después de editar `PLAN DEFINITIVO 2026.md`, regenera los datos de la app desde PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\generate-plan-data.ps1
```

El generador valida que existan las 86 entradas esperadas y conserva identificadores estables por fecha y posición.

## Publicación en GitHub Pages

El flujo `.github/workflows/deploy-pages.yml` compila y publica automáticamente la PWA al enviar cambios a la rama `main`.

En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen de publicación.
