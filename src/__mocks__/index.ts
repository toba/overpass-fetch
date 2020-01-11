import path from 'path';
import { AreaData } from '../types';
import { parseOsmXML } from '../parse';
import { tiles } from '../tile';
import { readFileText } from '@toba/node-tools';

const cache = new Map<string, AreaData>();

/**
 * Load sample data from `.osm` file.
 * @param fileName Name of `osm` file without extension
 */
export async function sampleData(fileName = 'simple'): Promise<AreaData> {
   tiles.fetchIfMissing = false;

   if (!cache.has(fileName)) {
      cache.set(
         fileName,
         parseOsmXML(
            await readFileText(path.join(__dirname, fileName + '.osm'))
         )
      );
   }
   return cache.get(fileName)!;

}
