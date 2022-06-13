const parse_pattern_regex = (pattern: string) => {
  let regex, include;

  //   (i.e., '# ...') || (i.e., '/') ||  (i.e., '')
  if (pattern.startsWith("#") || pattern === "/" || pattern === "") {
    regex = null;
    include = null;
    return;
  }

  //   (i.e., '!...')
  if (pattern.startsWith("!")) {
    include = false;
    pattern = pattern.slice(1);
  } else {
    include = true;
  }

  // change pattern
  console.log("pattern:", pattern);

  let override_regex = null;
  let split_parts = pattern.split("/");

  //  (i.e., '.../**/**' --> '.../**')
  for (let i = split_parts.length - 1; i >= 0; i--) {
    let prev = split_parts[i - 1];
    let seg = split_parts[i];
    if (prev === "**" && seg === "**") {
      split_parts.pop();
    }
  }
  //  (i.e., '**/')
  if (split_parts.length === 2 && split_parts[0] === "**" && !split_parts[1]) {
    override_regex = "^.+/.*$";
  }

  //  (i.e., '/...')
  if (split_parts[0] === "") {
    split_parts.shift();
  } else if (
    split_parts.length === 1 ||
    (split_parts.length === 2 && split_parts[1] === "")
  ) {
    if (split_parts[0] != "**") {
      split_parts.unshift("**");
    }
  }

  //   结束边界情况的处理
  if (split_parts.length === 0) {
    throw new Error("invalid pattern: " + pattern);
  }

  split_parts;

  //   (i.e., '.../' --> '.../**')
  if (split_parts.length > 1 && split_parts[split_parts.length - 1] === "") {
    split_parts[split_parts.length - 1] = "**";
  }

  //   build regular expression from pattern
  if (!override_regex) {
    let output = ["^"];
    let need_slash = false;
    let end = split_parts.length - 1;

    for (let q = 0; q < split_parts.length; q++) {
      if (split_parts[q] === "**") {
        if (q === 0 && q === end) {
          //   (i.e., '**')
          output.push(".+");
        } else if (q === 0) {
          output.push("(?:.+/)?");
          need_slash = false;
        } else if (q === end) {
          output.push("/.*");
        } else {
          output.push("(?:/.+)?");
          need_slash = true;
        }
      } else if (split_parts[q] === "*") {
        if (need_slash) {
          output.push("/");
        }
        output.push("[^/]+");
        need_slash = true;
      } else {
        if (need_slash) {
          output.push("/");
        }

        //
        let _rere = translate_segment_glob(split_parts[q]);
        output.push(_rere);
        if (q === end && include === true) {
          output.push("(?:/.*)?");
        }

        need_slash = true;
      }
    }

    output.push("$");
    regex = output.join("");
    output;
  }
  split_parts;
};

parse_pattern_regex("**/js");
