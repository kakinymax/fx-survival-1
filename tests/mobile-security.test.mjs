import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Android blocks cloud backup and device transfer of all persisted storage',()=>{
  const manifest=read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest,/android:allowBackup="false"/);
  assert.match(manifest,/android:fullBackupContent="false"/);
  assert.match(manifest,/android:dataExtractionRules="@xml\/data_extraction_rules"/);
  const rules=read('android/app/src/main/res/xml/data_extraction_rules.xml');
  for(const section of ['cloud-backup','device-transfer']){
    const body=rules.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`))?.[1];
    assert(body);
    for(const domain of ['root','file','database','sharedpref','external'])
      assert(body.includes(`<exclude domain="${domain}" path="." />`));
    assert.equal(body.includes('<include'),false);
  }
});
test('FileProvider exposes only a dedicated cache directory and remains private',()=>{
  const paths=read('android/app/src/main/res/xml/file_paths.xml');
  assert.match(paths,/<cache-path name="shared" path="shared\/"\s*\/>/);
  assert.equal(/<(root|files|external|external-files|external-cache)-path/.test(paths),false);
  assert.equal((paths.match(/<cache-path/g)||[]).length,1);
  const provider=read('android/app/src/main/AndroidManifest.xml').match(/<provider[\s\S]*?<\/provider>/)?.[0];
  assert.match(provider,/android:exported="false"/);
});
test('native runtime continues to use bundled assets without a remote site or cleartext server',()=>{
  const config=JSON.parse(read('capacitor.config.json'));
  assert.equal(config.webDir,'mobile/www');assert.equal(config.server.url,undefined);
  assert.notEqual(config.server.cleartext,true);
});
