// Generate an isolated UI-test project in ignored build output. The owner's
// signing project and Archive scheme are never changed by this test setup.
import xcode from 'xcode';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const project = xcode.project('ios/App/App.xcodeproj/project.pbxproj');
project.parseSync();
const objects = project.hash.project.objects;
objects.PBXGroup['504EC3061FED79650016851F'].path = JSON.stringify(path.resolve('ios/App/App'));
objects.PBXFileReference['958DCC722DB07C7200EA8C5F'].path = JSON.stringify(path.resolve('ios/debug.xcconfig'));
objects.XCLocalSwiftPackageReference['D4C12C0A2AAA248700AAC8A2'].relativePath = '"../App/CapApp-SPM"';
const app = project.getFirstTarget();
const dependencies = [...app.firstTarget.dependencies];
const target = project.addTarget('GestureTests', 'unit_test_bundle', 'GestureTests', 'com.kakinymax.fxsurvival.gesturetests');
target.pbxNativeTarget.productType = '"com.apple.product-type.bundle.ui-testing"';
const product = objects.PBXFileReference[target.pbxNativeTarget.productReference];
product.name = '"GestureTests.xctest"';
product.path = '"GestureTests.xctest"';
objects.PBXContainerItemProxy ??= {};
objects.PBXTargetDependency ??= {};
app.firstTarget.dependencies = dependencies;
project.addTargetDependency(target.uuid, [app.uuid]);
objects.PBXProject[project.hash.project.rootObject].attributes.TargetAttributes[target.uuid] = {
  CreatedOnToolsVersion: '26.3', TestTargetID: app.uuid
};
project.addBuildPhase([path.resolve('tests/ios-gestures.swift')], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
const configs = objects.XCConfigurationList[target.pbxNativeTarget.buildConfigurationList].buildConfigurations;
for (const { value } of configs) {
  const settings = objects.XCBuildConfiguration[value].buildSettings;
  delete settings.INFOPLIST_FILE;
  Object.assign(settings, { GENERATE_INFOPLIST_FILE: 'YES', SDKROOT: 'iphoneos',
    IPHONEOS_DEPLOYMENT_TARGET: '15.4', SWIFT_VERSION: '5.0', TARGETED_DEVICE_FAMILY: '1',
    TEST_TARGET_NAME: 'App', ENABLE_TESTING_SEARCH_PATHS: 'YES', CODE_SIGN_STYLE: 'Automatic' });
}
const destination = 'ios/build/Gestures.xcodeproj';
for (const section of Object.values(objects)) {
  for (const object of Object.values(section)) {
    if (object && typeof object === 'object') {
      for (const key of Object.keys(object)) if (object[key] === undefined) delete object[key];
    }
  }
}
const schemes = `${destination}/xcshareddata/xcschemes`;
await mkdir(schemes, { recursive: true });
await writeFile(`${destination}/project.pbxproj`, project.writeSync());
const reference = (id, name, product) => `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id}" BuildableName="${product}" BlueprintName="${name}" ReferencedContainer="container:Gestures.xcodeproj"/>`;
await writeFile(`${schemes}/Gestures.xcscheme`, `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2630" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
    <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="NO">${reference(app.uuid, 'App', 'App.app')}</BuildActionEntry>
    <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="NO">${reference(target.uuid, 'GestureTests', 'GestureTests.xctest')}</BuildActionEntry>
  </BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Debug" shouldUseLaunchSchemeArgsEnv="YES"><Testables>
    <TestableReference skipped="NO">${reference(target.uuid, 'GestureTests', 'GestureTests.xctest')}</TestableReference>
  </Testables></TestAction>
</Scheme>
`);
console.log('iOS gesture test project:', destination);
