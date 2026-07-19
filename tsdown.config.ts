import { lib } from 'tsdown-preset-sxzz'
import tsnapi from 'tsnapi/rolldown'

export default [
  lib(
    {},
    {
      plugins: [tsnapi()],
    },
  ),
  lib(
    {},
    {
      dts: false,
      exports: false,
      minify: true,
      outExtensions: () => ({ js: '.min.js' }),
    },
  ),
]
