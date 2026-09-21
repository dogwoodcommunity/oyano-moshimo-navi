const { withProjectBuildGradle } = require("expo/config-plugins");

// NDK r27's flexible-page-size option sets max-page-size, but not
// common-page-size. Apply both when linking every source-built native module.
// Prebuilt AAR libraries are NOT repaired by this setting; inspect the final APK.
const marker = "// oyano-16kb-source-linking";
const gradle = `
${marker}
subprojects { nativeProject ->
  ["com.android.application", "com.android.library"].each { androidPlugin ->
    nativeProject.plugins.withId(androidPlugin) {
      nativeProject.extensions.getByName("androidComponents").finalizeDsl { androidDsl ->
        def cmake = androidDsl.defaultConfig.externalNativeBuild.cmake
        ["SHARED", "MODULE", "EXE"].each { kind ->
          def prefix = "-DCMAKE_" + kind + "_LINKER_FLAGS="
          def previous = cmake.arguments.findAll { it.startsWith(prefix) }
          if (previous.size() > 1) {
            throw new GradleException("Ambiguous native linker flags in " + nativeProject.path)
          }
          def flags = previous.isEmpty() ? "" : previous[0].substring(prefix.length())
          if (flags.contains("page-size") || flags.contains("norelro")) {
            throw new GradleException("Review conflicting native memory flags in " + nativeProject.path)
          }
          cmake.arguments.removeAll(previous)
          cmake.arguments.add(prefix + flags + " -Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384")
        }
      }
    }
  }
}
`;

module.exports = function withAndroidPageSize(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") throw new Error("Review Android page-size plugin for the new Gradle template");
    // React's root plugin can evaluate child projects immediately. Register
    // finalizeDsl callbacks BEFORE applying it, not at the end of the file.
    const anchor = 'apply plugin: "expo-root-project"';
    if (!mod.modResults.contents.includes(anchor)) throw new Error("Review Android root plugin order before adding native linker flags");
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents = mod.modResults.contents.replace(anchor, gradle + "\n" + anchor);
    return mod;
  });
};
