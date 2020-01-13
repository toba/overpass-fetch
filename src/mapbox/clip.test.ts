import '@toba/test';
import { GeoJsonType as Type } from '@toba/map';
import { clip } from './clip';
import { MemLine, MemFeature, MemGeometry, Axis } from './types';

const makeLine = (geometry: number[]): MemFeature => ({
   geometry,
   type: Type.Line,
   tags: { value: 2 },
   minX: 0,
   minY: 0,
   maxX: 50,
   maxY: 60
});

const close = (line: number[]) => [line.concat(line.slice(0, 3))];

// prettier-ignore
const geom1 = [0,0,0,50,0,0,50,10,0,20,10,0,20,20,0,30,20,0,30,30,0,50,30,0,50,40,0,25,40,0,25,50,0,0,50,0,0,60,0,25,60,0];
const geom2 = [0, 0, 0, 50, 0, 0, 50, 10, 0, 0, 10, 0];

const copy = (
   f: MemFeature,
   minX = f.minX,
   minY = f.minY,
   maxX = f.maxX,
   maxY = f.maxY,
   geometry: MemGeometry
): MemFeature => ({
   id: undefined,
   geometry,
   type: f.type,
   tags: f.tags,
   minX: minX,
   minY: minY,
   maxX: maxX,
   maxY: maxY
});

it('clips polylines', t => {
   const k1 = 10;
   const k2 = 40;
   const a = Axis.Horizontal;

   const line1: MemFeature = {
      geometry: geom1,
      type: Type.Line,
      tags: { value: 1 },
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 60
   };
   const line2: MemFeature = {
      geometry: geom2,
      type: Type.Line,
      tags: { value: 2 },
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 10
   };
   const out1 = copy(line1, k1, 0, k2, 60, [
      [k1, 0, 1, 40, 0, 1],
      [k2, 10, 1, 20, 10, 0, 20, 20, 0, 30, 20, 0, 30, 30, 0, 40, 30, 1],
      [k2, 40, 1, 25, 40, 0, 25, 50, 0, 10, 50, 1],
      [k1, 60, 1, 25, 60, 0]
   ]);
   const out2 = copy(line2, k1, 0, k2, 10, [
      [k2, 0, 1, 40, 0, 1],
      [k2, 10, 1, 10, 10, 1]
   ]);

   const clipped = clip([line1, line2], 1, k1, k2, a, -Infinity, Infinity, {});

   expect(clipped).toEqual([out1, out2]);
});

it('clips lines with line metrics on', () => {
   const a = Axis.Horizontal;
   const k1 = 10;
   const k2 = 40;
   const geom = geom1.slice() as MemLine;
   geom.size = 0;

   for (let i = 0; i < geom.length - 3; i += 3) {
      const dx = geom[i + 3] - geom[i];
      const dy = geom[i + 4] - geom[i + 1];
      geom.size += Math.sqrt(dx * dx + dy * dy);
   }
   geom.start = 0;
   geom.end = geom.size;

   const clipped = clip([makeLine(geom)], 1, k2, k2, a, -Infinity, Infinity, {
      lineMetrics: true
   });

   expect(clipped).not.toBeNull();

   expect(
      clipped!.map(f => {
         const line = f.geometry as MemLine;
         return [line.start, line.end];
      })
   ).toEqual([
      [k1, k2],
      [70, 130],
      [160, 200],
      [230, 245]
   ]);
});

it('clips polygons', () => {
   const k1 = 10;
   const k2 = 40;
   const a = Axis.Horizontal;

   const poly1: MemFeature = {
      geometry: close(geom1),
      type: Type.Polygon,
      tags: { value: 1 },
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 60
   };
   const poly2: MemFeature = {
      geometry: close(geom2),
      type: Type.Polygon,
      tags: { value: 2 },
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 10
   };
   // prettier-ignore
   const out1 = copy(poly1, k1, 0, k2, 60, [[
      10,0,1,40,0,1,40,10,1,20,10,0,20,20,0,30,20,0,30,30,0,40,30,1,
      40,40,1,25,40,0,25,50,0,10,50,1,10,60,1,25,60,0,10,24,1,10,0,1
   ]]);
   // prettier-ignore
   const out2 = copy(poly2, k1, 0, k2, 10, [[
      10,0,1,40,0,1,40,10,1,10,10,1,10,0,1
   ]]);

   const clipped = clip([poly1, poly2], 1, k1, k2, a, -Infinity, Infinity, {});

   expect(clipped).toEqual([out1, out2]);
});

test('clips points', t => {
   const k1 = 10;
   const k2 = 40;
   const a = Axis.Horizontal;

   const f1: MemFeature = {
      geometry: geom1,
      type: Type.MultiPoint,
      tags: { value: 1 },
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 60
   };
   const f2: MemFeature = {
      geometry: geom2,
      type: Type.MultiPoint,
      tags: { value: 2 },
      minX: 0,
      minY: 0,
      maxX: 50,
      maxY: 10
   };
   // prettier-ignore
   const out1 = copy(f1, 20, k1, 30, 60, [
      20,10,0,20,20,0,30,20,0,30,30,0,25,40,0,25,50,0,25,60,0
   ]);

   const clipped = clip([f1, f2], 1, k1, k2, a, -Infinity, Infinity, {});

   expect(clipped).toEqual(out1);
});
