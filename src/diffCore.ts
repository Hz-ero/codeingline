import { diff_match_patch as DMP } from "diff-match-patch";
import type { Diff } from "diff-match-patch";

export type Action = "insert" | "delete" | "move";

export type Patch = {
  action: Action;
  start: number;
  steps: number;
  text: string;
};

export type SnapObject = {
  content: string;
  patches: Array<Patch[]>;
};

export /**
 * @description  computed a differences array which describe the transformation of text1 into text2.
 * @param {string} before
 * @param {string} after
 * @return {*}  {Diff[]}
 */
const diff = (before: string, after: string): Diff[] => {
  const differ = new DMP();
  const delta = differ.diff_main(before, after);

  return delta;
};

export /**
 * @description Generate a list of patches from a diff
 * @param {string} before
 * @param {string} after
 * @return {*}  {Patch[]}
 */
const caculatePatches = (before: string, after: string): Patch[] => {
  let lastStepIndex = 0;
  let result: Patch[] = [];
  let diffs = diff(before, after);
  for (const dif of diffs) {
    let step: Patch = {
      action: "move",
      start: 0,
      steps: dif[1].length,
      text: dif[1],
    };

    switch (dif[0]) {
      case -1:
        step.action = "delete";
        step.start = lastStepIndex + step.steps;
        result.push(step);
        lastStepIndex = step.start - step.steps;
        break;
      case 0:
        step.action = "move";
        step.start = lastStepIndex;
        // result.push(step);
        lastStepIndex = step.start + step.steps;
        break;
      case 1:
        step.action = "insert";
        step.start = lastStepIndex;
        result.push(step);
        lastStepIndex = step.start + step.steps;
        break;
    }
  }

  return result;
};

// 用来描述编辑动作，只操作一个字符
export type EditorAction = {
  action: Action;
  position: number;
  char: string;
};

export /**
 * @description 将patch拆分成EditorAction数组
 * @param {Patch} patch
 * @return {*}  {EditorAction[]}
 */
const createActions = (patch: Patch): EditorAction[] => {
  let actions = [];
  for (const act of gen(patch)) {
    actions.push(act);
  }
  return actions;
};

/**
 * @description 生成器
 * @param {Patch} _patch
 * @return {*}  {Generator<EditorAction>}
 */
function* gen(_patch: Patch): Generator<EditorAction> {
  let { action, start, steps, text } = _patch;
  if (action === "insert") {
    // insert
    for (let q = 0; q < steps; q++) {
      yield {
        action,
        position: start + q,
        char: text[q],
      };
    }
  } else if (action === "delete") {
    // delete
    for (let q = 0; q < steps; q++) {
      yield {
        action,
        position: start - q,
        char: "",
      };
    }
  }
}

export const applyPatch = (before: string, patch: Patch): any => {
  switch (patch.action) {
    case "insert":
      return (
        before.slice(0, patch.start) + patch.text + before.slice(patch.start)
      );

    case "delete":
      return (
        before.slice(0, patch.start - patch.steps) + before.slice(patch.start)
      );

    case "move":
      return before;
  }
};

export /**
 * @description 等待
 * @param {number} ms
 * @return {*}
 */
const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

let patchesData = `[
  [{ "action": "insert", "start": 0, "steps": 4, "text": "good" }],
  [],
  [{ "action": "insert", "start": 4, "steps": 4, "text": " dog" }],
  [
    { "action": "delete", "start": 3, "steps": 3, "text": "goo" },
    { "action": "insert", "start": 0, "steps": 2, "text": "ba" }
  ]
]`;

export const parsePatchToString = (
  patchSteps: Array<Patch[]>,
  targetStep: number
): string => {
  let result = "";
  if (targetStep <= 0) return "";

  for (let q = 0; q < targetStep; q++) {
    for (const patch of patchSteps[q]) {
      let { action, start, steps, text } = patch;
      if (action === "insert") {
        result = result.slice(0, start) + text + result.slice(start);
      } else if (action === "delete") {
        result = result.slice(0, start - steps) + result.slice(start);
      }
    }
  }
  return result;
};

let patchSteps = JSON.parse(patchesData);
let curContent = parsePatchToString(patchSteps, 1);
console.log(curContent);
