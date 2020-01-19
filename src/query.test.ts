import { Query } from './query'
import { Format } from './types'

it('generates valid Compass QL', () => {
   const q = new Query([10, 10, 10, 10])
   q.outputAs = Format.JSON

   expect(q.toString()).toBe('')
})
