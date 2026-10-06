# Third-party content

Blood on the Clocktower characters, ability wording and official jinx rules are attributed to The Pandemonium Institute. User-added theme content remains attributed to its original rights holders. This is an unofficial fan application; it does not claim ownership of character content or affiliation with those publishers.

Individual corpus records and the `sources` directory preserve source attribution. Publishing this repository does not grant a new license to third-party character content.

The Windows portable package includes an unmodified Node.js runtime. Its license and dependency notices are reproduced in `runtime/LICENSE.txt`, from the official Node.js v24.7.0 release. The build uses that pinned runtime in GitHub Actions. When changing runtime versions, update `packaging/NODE-LICENSE.txt` to the corresponding official release license.

## Embedded Laya desktop runtime

Laya 0.3.6 by Convai Innovations and the convaiinnovations/laya checkpoint (revision 5e7b2b1b8ca2ecdd3f2322d94069c9b6ce7e844b) are Apache-2.0 licensed. Model: https://huggingface.co/convaiinnovations/laya. Runtime: https://github.com/convaiinnovations/laya. Their unmodified installed packages and distribution license files ship under runtime/python/Lib/site-packages, and the Apache license ships under packaging/LAYA-LICENSE.txt and runtime/laya-model/LICENSE.txt. Python retains its bundled LICENSE.txt. PyTorch, Transformers, NumPy, tokenizer and supporting libraries retain their package distribution license notices. Our worker and integration are application code; no Laya routing server is used.
