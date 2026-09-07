# What the export SHA-256 means

The receipt's `integrity.digest` hashes UTF-8 `JSON.stringify` of this object, in this top-level key order:

~~~javascript
{ format: payload.format, version: payload.version, exported_at: payload.exported_at, task: payload.task }
~~~

It excludes the `integrity` field itself and the file's formatting whitespace. It is therefore different from `Get-FileHash`, `sha256sum`, or another whole-file byte digest. Keep the nested data and property order intact. Import recomputes the content digest and rejects a mismatch before importing records.

To check a saved file locally, replace `export.json` below with that file's path. The command reads the file and prints a checksum result; it makes no network request and does not print intent content.

~~~shell
node -e "const fs=require('node:fs'),c=require('node:crypto');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const b={format:p.format,version:p.version,exported_at:p.exported_at,task:p.task};const d=c.createHash('sha256').update(JSON.stringify(b),'utf8').digest('hex');if(d!==p.integrity.digest)throw Error('Content digest mismatch');console.log('Content digest OK: '+d);" export.json
~~~

A matching checksum detects accidental changes; it does not authenticate the file's author. An attacker can alter a file and recompute a checksum. Import still needs explicit confirmation and validates the portable schema and provenance rules. Copies saved outside the plugin-managed directory are outside `/intent forget`'s deletion scope.
