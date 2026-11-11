# Ejemplo de guía aérea (AWB)

Este es un ejemplo editable de Report Studio basado en la imagen proporcionada. Todos los nombres, identificadores, vuelos e importes son ficticios. Es una muestra visual, no un documento aprobado por una aerolínea o por IATA.

- `awb-full-form-example.json`: reporte lleno con líneas y etiquetas.
- `awb-data-only-example.json`: los mismos datos en las mismas posiciones, para papel preimpreso.
- `awb-full-form-template.json` y `awb-data-only-template.json`: diseños equivalentes con tablas vacías.
- `awb-sample-data.json`: registros de ejemplo agrupados por identificador de tabla. En Registros selecciona una tabla y usa **Cargar datos JSON** con este archivo; repite la operación para las demás tablas. La asociación al archivo solo permanece durante la sesión.
- `*-example.pdf`: salida de muestra de cada reporte lleno.

Abre cualquiera de los JSON llenos con **Abrir**. Los archivos llenos incluyen registros ficticios a propósito; no coloques datos reales de clientes en un archivo compartido. Al guardar desde la aplicación se genera una plantilla sin los registros. La muestra contiene una sola AWB: `goods` proporciona los detalles repetidos. Embarcador, consignatario, agente, aeropuertos de origen y destino y aerolínea tienen tablas separadas por función y están relacionados con `awb`. Los aeropuertos se relacionan con sus respectivas tablas de países.

Ambas versiones sitúan los datos de ejemplo en las mismas coordenadas. Antes de imprimir sobre un formato preimpreso es necesario calibrar el papel, los márgenes, la escala y los desplazamientos de la impresora. Esta muestra admite una AWB por reporte; para otra AWB utiliza un conjunto de datos filtrado independiente. Comprueba el desbordamiento y la paginación antes de usarla en producción.

La zona de mercancías y sus líneas continuas están ajustadas para los tres registros de esta prueba. Si cambia la cantidad o la altura de sus descripciones, revisa la posición de los totales y la paginación. La imagen de referencia incluye un código QR y un código de barras; este ejemplo no los genera.
