import { Format } from './types';

/**
 * An Overpass query.
 */
export class Query {
   timeout: number;
   outputFormat: Format;

   /**
    * Convert query instance to string for transmission to the API.
    */
   toString(): string {
      return '';
   }
}
