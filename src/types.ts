/**
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#Output_Format_.28out:.29
 */
export const enum Format {
   JSON = 'json',
   XML = 'xml',
   /**
    * CSV output format returns OSM data as csv document, which can be directly
    * opened in tools like LibreOffice. It requires additional configuration
    * parameters to define a list of fields to display, as well as two optional
    * parameters for adding/removing the CSV header line and changing the column
    * separator.
    *
    * @example
    * [out:csv( fieldname_1 [,fieldname_n ...] [; csv-headerline [; csv-separator-character ] ] )]
    */
   CSV = 'csv',
   Custom = 'custom',
   Popup = 'popup'
}

export interface Statement {
   maybe: boolean;
}
