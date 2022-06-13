/* eslint-disable curly */
import {
  workspace,
  Selection,
  commands,
  Uri,
  ExtensionContext,
  window,
  TextEditor,
} from "vscode";
import {
  caculatePatches,
  createActions,
  parsePatchToString,
  Patch,
  sleep,
  SnapObject,
} from "./diffCore";
import { MemFS } from "./fsProvider";

export function activate(context: ExtensionContext) {
  // -----------Global-----------
  const memFs = new MemFS();
  // -----------属性-----------
  let initialized = false;
  let ignoreFileOrDirectory = [
    "node_modules",
    ".git",
    "package-lock.json",
    ".path",
  ];
  // -----------方法-----------
  const deleteAllFiles = () => {
    let allDirectories = memFs.readDirectory(Uri.parse("memfs:/"));
    console.log("all directiories:", allDirectories);
    for (const [name] of allDirectories) {
      memFs.delete(Uri.parse(`memfs:/${name}`));
    }
    initialized = false;
  };

  const initWorkSpace = () => {
    workspace.updateWorkspaceFolders(0, 0, {
      uri: Uri.parse("memfs:/"),
      name: "MemFS - Sample",
    });
  };
  const checkFileNeedIgnore = (filePath: string): boolean => {
    // todo
    return false;
  };
  const checkSnapFileExisted = (fileUri: Uri): boolean => {
    try {
      let fileStat = memFs.stat(fileUri);
      return true;
    } catch (error) {
      return false;
    }
  };
  const createSnapFile = (fileUri: Uri): void => {
    memFs.myWriteFile(fileUri, new Uint8Array(0), {
      create: true,
      overwrite: true,
    });
  };

  /**
   * @description 初始化创建snap文件
   * @param {Uri} fileUri
   * @param {string} initData 初始化数据
   */
  const initSnapfile = (fileUri: Uri, initData: string) => {
    let initPatches: Patch[] = caculatePatches("", initData);
    let snapObject: SnapObject = {
      content: initData,
      patches: [initPatches],
    };
    memFs.myWriteFile(fileUri, Buffer.from(JSON.stringify(snapObject)), {
      create: true,
      overwrite: true,
    });
  };

  const addSnapShot = () => {
    let actDocument = window.activeTextEditor?.document;
    // eslint-disable-next-line curly
    if (!actDocument) return;
    const actDocContent: string = actDocument.getText();

    let filePath = actDocument?.uri.path;
    if (!filePath) return;
    const fileIgnored = checkFileNeedIgnore(filePath);
    if (fileIgnored) return;

    const snapFileUri: Uri = Uri.parse("memfs:/.snap" + filePath + ".json");
    const snapFileExisted = checkSnapFileExisted(snapFileUri);
    if (!snapFileExisted) {
      initSnapfile(snapFileUri, actDocContent);
    }

    // -----------------
    let fileJsonData = memFs.readFile(snapFileUri).toString();

    let snapFileObject: SnapObject = JSON.parse(fileJsonData);

    const snapFileContent: string = snapFileObject.content;
    const latestPatches = caculatePatches(snapFileContent, actDocContent);

    // -----------------
    snapFileObject.content = actDocContent;
    snapFileObject.patches.push(latestPatches);

    // -----------------
    memFs.writeFile(snapFileUri, Buffer.from(JSON.stringify(snapFileObject)), {
      create: true,
      overwrite: true,
    });

    window.showInformationMessage("add snapshot");
  };

  const playSnapPatchesFromStart = async () => {
    // -----------------
    let actEditor = window.activeTextEditor;
    if (!actEditor) return;
    // -----------------
    let actDocument = actEditor.document;
    if (!actDocument) return;

    // -----------------
    let filePath = actDocument?.uri.path;
    if (!filePath) return;

    // -----------------
    const snapFileUri: Uri = Uri.parse("memfs:/.snap" + filePath + ".json");
    const snapFileExisted = checkSnapFileExisted(snapFileUri);
    if (!snapFileExisted)
      window.showErrorMessage("该文件没有相应快照，请创建快照！");

    // -----------------
    let fileJsonData = memFs.readFile(snapFileUri).toString();
    let snapPatches: Array<Patch[]> = JSON.parse(fileJsonData).patches;

    // todo
    replayCodeBetween(snapPatches, {
      start: 0,
      end: Infinity,
      typeDelay: 100,
      stepDelay: 1200,
    });
  };
  type ReplayOption = {
    start: number;
    end: number;
    typeDelay: number;
    stepDelay: number;
  };

  /**
   * @description 执行两次快照之间的代码重播
   * @param {SnapObject} snapObject
   * @param {ReplayOption} option
   * @return {*}
   */
  const replayCodeBetween = async (
    snapPatches: Array<Patch[]>,
    option: ReplayOption
  ) => {
    // 编辑器
    let actEditor = window.activeTextEditor;
    if (!actEditor) return;

    // 重播控制项
    let { start, end, typeDelay, stepDelay } = option;
    end = end > snapPatches.length ? snapPatches.length : end;

    // 计算经过0-->start步数后的文本内容,将内容替换到当前文档
    let startContent = parsePatchToString(snapPatches, start);
    await actEditor.edit((editBuilder) => {
      editBuilder.replace(actEditor!.visibleRanges[0], startContent);
    });

    // 拆分start-->end步数patch，生成编辑动作显示
    for (let q = start; q < end; q++) {
      for (const patch of snapPatches[q]) {
        let animates = createActions(patch);
        for (const anim of animates) {
          // 计算鼠标位置
          let posi = actEditor.document.positionAt(anim.position);
          // 定位到位置
          actEditor.selection = new Selection(posi, posi);

          // 执行插入或者删除操作
          if (anim.action === "insert") {
            await actEditor.edit((editBuilder) => {
              editBuilder.insert(posi, anim.char);
            });
            await sleep(typeDelay);
          } else if ((anim.action = "delete")) {
            commands.executeCommand("deleteLeft");

            await sleep(stepDelay);
          }
        }
      }
    }
  };

  const createFiles = () => {
    if (initialized) {
      return;
    }
    initialized = true;

    // most common files types
    memFs.writeFile(
      Uri.parse(`memfs:/package.json`),
      Buffer.from(
        JSON.stringify({
          name: "memfs",
          version: "0.0.1",
          description: "Sample extension for memfs",
          main: "index.js",
          scripts: {
            test: 'echo "Error: no test specified" && exit 1',
          },
        })
      ),
      {
        create: true,
        overwrite: true,
      }
    );

    memFs.writeFile(
      Uri.parse(`memfs:/.gitignore`),
      Buffer.from(
        `node_modules
        npm-debug.log
        yarn-error.log
        yarn-debug.log
        yarn-lock.json
        package-lock.json
        .DS_Store
        .vscode
        .env`
      ),
      {
        create: true,
        overwrite: true,
      }
    );

    // some more files & folders
    memFs.createDirectory(Uri.parse(`memfs:/src/`));
    memFs.createDirectory(Uri.parse(`memfs:/src/js`));

    memFs.writeFile(
      Uri.parse(`memfs:/src/js/index.js`),
      Buffer.from("console.log('hello world')"),
      {
        create: true,
        overwrite: true,
      }
    );
    memFs.writeFile(
      Uri.parse(`memfs:/src/index.html`),
      Buffer.from(`<html><body>foo</body></html>`),
      { create: true, overwrite: true }
    );
    let ssss = memFs.readFile(Uri.parse(`memfs:/.gitignore`)).toString();
    const oneFsPath = Uri.parse(`memfs:/src/js/index.js`);
    console.log("oneFsPath:", oneFsPath.path);
    // stroe direction
    memFs.createDirectory(Uri.parse(`memfs:/.snap/`));
  };
  // -----------功能-----------
  let playSnapPatchesFromStartCommand = commands.registerCommand(
    "memfs.playSnapPatches",
    playSnapPatchesFromStart
  );
  let memoryFileSystem = workspace.registerFileSystemProvider("memfs", memFs, {
    isCaseSensitive: true,
  });
  let addSnapShotCommand = commands.registerCommand(
    "memfs.addSnapShot",
    addSnapShot
  );
  let deleteAllFilesCommand = commands.registerCommand(
    "memfs.reset",
    deleteAllFiles
  );

  let initWorkspaceCommand = commands.registerCommand(
    "memfs.workspaceInit",
    initWorkSpace
  );
  let createFilesCommand = commands.registerCommand("memfs.init", createFiles);
  // ----------注册----------
  context.subscriptions.push(memoryFileSystem);
  context.subscriptions.push(deleteAllFilesCommand);
  context.subscriptions.push(createFilesCommand);
  context.subscriptions.push(addSnapShotCommand);
  context.subscriptions.push(initWorkspaceCommand);
  context.subscriptions.push(playSnapPatchesFromStartCommand);
}
