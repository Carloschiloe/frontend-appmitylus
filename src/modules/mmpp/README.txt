Coloca esta carpeta 'spa-mmpp' en la RAIZ de tu proyecto (junto a 'html', 'js', 'css', etc.).

Archivos:
- /spa-mmpp/mmpp-api.js        → adaptador API
- /spa-mmpp/mmpp-inventario.jsx → componente React + render

Luego edita el archivo:
html/Abastecimiento/asignacion/inventario_mmpp.html

Reemplaza su contenido por este mínimo:
------------------------------------------------
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Inventario MMPP</title>

    <!-- React 18 + Babel (para ejecutar JSX del .jsx externo) -->
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>

    <link rel="stylesheet" href="../../styles.css"/>
  </head>
  <body class="grey lighten-5">
    <div class="container" style="margin-top:24px;margin-bottom:32px;">
      <div id="root"></div>
    </div>

    <script src="/spa-mmpp/mmpp-api.js"></script>
    <script type="text/babel" src="/spa-mmpp/mmpp-inventario.jsx"></script>
  </body>
</html>
------------------------------------------------

Con esto mantienes tu árbol antiguo, pero el módulo nuevo vive separado en /spa-mmpp y es fácil migrarlo luego a Vite.
