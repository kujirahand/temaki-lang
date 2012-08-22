// Temaki言語の定義を行う
(function (self) {
  if (typeof(self.Temaki) == "object") return;  
  var T = {};
  self.Temaki = T;
  // public method
  T.useDebug = false;
  T.scope = self;
  T.quit = false;
  T.eval = function (source) {
    var tokens = tokenize(source);
    // debug : tokenize
    T.log("tokenize");
    for(var i = 0; i < tokens.length; i++) {
      T.log("-" + tokens[i].no + ":" + tokens[i].word);
    }
    T.quit = false;
    return run(tokens);
  };
  T.log = function (s) { // output log
    if (this.useDebug) this.print(s);
  };
  T.print = function (s) { print(s); }
  // 単語に分割する
  function tokenize(source) {
    var r = [];
    // 簡単にソースを整形する
    var source = source.split("\r\n").join("\n");
    var lines = source.split("\n");
    for (var n = 0; n < lines.length; n++) {
      var s = lines[n];
      var no = n + 1;
      while (s != '') {
        s = s.replace(/^\s+/, ''); // trim left
        if (s == "") break;  
        var c = s.charAt(0);
        var ob = {"no":no, "type":""};
        if (c == '#') break; // line comment
        if (c == '(' || c == ')') { // ( .. ) 
          s = s.substr(1);
          continue;
        }
        if (c == "{" || c == "}") {
          ob.type = "block";
          ob.word = c;
          s = s.substr(1);
          r.push(ob);
          continue;
        }
        if (c == ":") {
          ob.type = "end";
          ob.word = c;
          r.push(ob);
          s = s.substr(1);
          continue;
        }
        if (c == '"' || c == "'") { // string
          var str = ob.word = getStringToken(s, no);
          s = s.substr(str.length);
          str = str.substr(1, str.length - 2);
          str = str.split("\\n").join("\n");
          str = str.split('\\"').join('"');
          str = str.split("\\'").join("'");
          str = str.split("\\t").join("\t");
          ob.type = "string";
          ob.value = str;
          r.push(ob);
          continue;
        }
        if (c == '.') {
          ob.type = "print";
          ob.word = ".";
          r.push(ob);
          s = s.substr(1);
          continue;
        }
        if (s.match(/^(\-{0,1}[0-9\.]+)/)) {
          var str = ob.word = RegExp.$1;
          ob.type  = "number";
          ob.value = parseFloat(str);
          r.push(ob);
          s = s.substr(str.length);
          continue;
        }
        if (s.match(/^(\%{0,1}[a-zA-Z0-9\_]+)/)) {
          var str = RegExp.$1;
          ob.type = "word";
          ob.word = str;
          s = s.substr(str.length);
          r.push(ob);
          continue;
        }
        if (s.match(/^([\!\+\-\*\/\%\<\>\=\/\|\&]{1,2})/)) {
          var str = RegExp.$1;
          ob.type = "operator";
          ob.word = str;
          s = s.substr(str.length);
          r.push(ob);
          continue;
        }
        throw new Error("Unknown char [" + c + "] line " + no);
      }
    }
    return r;
  }
  function getStringToken(s, no) {
    var c = s.charAt(0);
    var i = 1;
    while (i < s.length) {
      var c2 = s.charAt(i);
      if (c2 == c) {
        i++;
        return s.substr(0, i);
      }
      if (c2 == "\\") {
        i += 2; continue;
      }
      i++;
    }
    throw new Error("string not close : line " + no);
  }
  //
  T.varTable = {};  // global variables
  T.lvarTable = {}; // local variables
  T.stack = [];
  T.jumpStack = [];
  T.callStack = [];
  // 実行する
  function run(tokens) {
    T.stack = [];
    run_tokens(tokens);
    var r = (T.stack.length > 0) ? T.stack[0] : null;
    return r;
  }
  function run_push(v) {
    T.stack.push(v);
    T.log(" | - push) " + getObjectDesc(v));
  }
  function run_pop() {
    var v = T.stack.pop();
    T.log(" | - pop_) " + getObjectDesc(v));
    return v;
  }
  function run_tokens(tokens) {
    if (T.quit) return null;
    var i = 0;
    while (i < tokens.length) {
      var t = tokens[i];
      T.log(" - run-) {line:" + t.no + ",i:" + i + "} > " + t.word);
      // 値
      if (t.type == "number" || t.type == "string") {
        run_push(t.value);
        i++;
        continue;
      }
      // 関数コール
      if (t.word == "call" || t.word == "!") {
        i = run_call(t, i);
        continue;
      }
      // 計算
      if (t.type == "operator") {
        run_operator(t);
        i++;
        continue;
      }
      // 組み込み関数
      if (t.type == "print" || t.word == "print") {
        var v = run_pop();
        T.print(v);
        i++;
        continue;
      }
      // 代入
      if (t.word == "set") {
        var name_t = run_pop();
        var value = run_pop();
        T.varTable[name_t.word] = value;
        i++;
        continue;
      }
      // 参照
      if (t.word == "get") {
        var name_t = run_pop();
        if (name_t.type !== "word") {
          throw new Error("get error line at " + name_t.no);
        }
        var value = run_getVar(name_t.word);
        run_push(value);
        i++;
        continue;
      }
      // ローカル変数操作
      if (t.word == "lset") {
        var name_t = run_pop();
        var value = run_pop();
        T.lvarTable[name_t.word] = value;
        i++;
        continue;
      }
      // ローカル変数の定義
      if (t.word == "lvar") {
        var name_t = run_pop();
        T.lvarTable[name_t.word] = null;
        i++;
        continue;
      }
      // スタック操作
      if (t.word == "dup") {
        var v = run_pop();
        run_push(v);
        run_push(v);
        i++;
        continue;
      }
      if (t.word == "drop") {
        run_pop();
        i++;
        continue;
      }
      // inc
      if (t.word == "inc") {
        var name_t = run_pop();
        if (typeof(T.lvarTable[name_t.word]) != "undefined") {
          T.lvarTable[name_t.word]++;
        } else {
          T.varTable[name_t.word]++;
        }
        i++;
        continue;
      }
      if (t.word == "dec") {
        var name_t = run_pop();
        if (typeof(T.lvarTable[name_t.word]) != "undefined") {
          T.lvarTable[name_t.word]--;
        } else {
          T.varTable[name_t.word]--;
        }
        i++;
        continue;
      }
      // 配列操作
      if (t.word == "array_new") {
        var a = [];
        run_push(a);
        i++;
        continue;
      }
      if (t.word == "array_set") {
        var value = run_pop();
        var index = run_pop();
        var arr = run_pop();
        arr[index] = value;
        i++;
        continue;
      }
      if (t.word == "array_get") {
        var index = run_pop();
        var arr = run_pop();
        var value = arr[index];
        run_push(value);
        i++;
        continue;
      }
      // ブロックの定義
      if (t.word == "{") {
        getBlockToken(tokens, i, t);
        i = t.block_end;
        run_push(t);
        continue;
      }
      if (t.word == "}") {
        i = run_exit(t, "block");
        continue;
      }
      if (t.word == "exit") {
        i = run_exit(t, "call");
        continue;
      }
      if (t.word == "continue") {
        var flag = false;
        while (T.jumpStack.length > 0) {
          var jo = T.jumpStack.pop();
          if (jo.type == "if" || jo.type == "ifelse") continue;
          i = jo.next();
          flag = true;
          break;
        }
        if (!flag) throw new Error("no continue loop line " + t.no);
        continue;
      }
      if (t.word == "break") {
        var flag = false;
        while (T.jumpStack.length > 0) {
          var jo = T.jumpStack.pop();
          if (jo.type == "if" || jo.type == "ifelse") continue;
          i = jo.end_i;
          flag = true;
          break;
        }
        if (!flag) throw new Error("no continue loop line " + t.no);
        continue;
      }
      // if
      if (t.word == "if") {
        var cond = run_pop();
        var true_block = run_pop();
        if (cond) {
          var jo = {};
          jo.type = "if";
          jo.end_i = i + 1;
          jo.next = function () { return this.end_i; }
          T.jumpStack.push(jo);
          i = true_block.block_begin;
          continue;
        }
        i++;
        continue;
      }
      if (t.word == "ifelse") {
        var cond = run_pop();
        var false_block = run_pop();
        var true_block = run_pop();
        var jo = {};
        jo.type = "ifelse";
        jo.end_i = i + 1;
        jo.next = function() { return this.end_i; }
        T.jumpStack.push(jo);
        if (cond) {
          i = true_block.block_begin;
        } else {
          i = false_block.block_begin;
        }
        continue;
      }
      // for 
      if (t.word == "for") {
        // ジャンプ用のオブジェクトを生成
        var jo = {};
        jo.type = "for";
        jo.name = run_pop();
        jo.to_v = run_pop();
        jo.from_v = run_pop();
        jo.block_t = run_pop();
        // 変数チェック
        if (typeof(jo.name) != "object" || 
            jo.name["type"] !== "word") {
          throw new Error("for variable error line " + t.no);
        }
        jo.loopvar = jo.name.word;
        jo.end_i = (i + 1);
        jo.next = function () {
          var v = (++T.lvarTable[this.loopvar]);
          var i;
          if (v > this.to_v) {
            i = this.end_i;
          } else {
            T.log("for-next=" + v);
            T.jumpStack.push(this);
            i = this.block_t.block_begin;
          }
          return i;
        };
        // set
        T.lvarTable[jo.loopvar] = jo.from_v;
        if (jo.from_v > jo.to_v) { // forを実行しない
          i++; continue; 
        }
        T.log("for-begin=" + jo.from_v);
        T.jumpStack.push(jo);
        i = jo.block_t.block_begin;
        continue;
      }
      // while 
      if (t.word == "while") {
        var cond = run_pop();
        var block = run_pop();
        if (cond) {
          var jo = {};
          jo.type = "while";
          jo.end_i = block.block_end;
          jo.block = block;
          jo.next = function () {
            T.stack.push(this.block);
            return this.end_i;
          };
          T.jumpStack.push(jo);
          T.log("while=" + cond);
          i = block.block_begin;
        } else {
          i++;
        }
        continue;
      }
      if (t.word == "jseval") {
        var src = run_pop();
        var r = eval(src);
        run_push(r);
        i++;
        continue;
      }
      if (t.word == "quit") {
        T.quit = true;
        return;
      }
      // その他のワード(たぶん変数)
      if (t.type == "word") {
        if (t.word.charAt(0) == "%") { // 変数の値参照
          var name = t.word.substr(1);
          var v = run_getVar(name);
          run_push(v);
        } else { // 変数自体をスタックに乗せる
          run_push(t);
        }
        i++;
        continue;
      }
      if (t.word == ":") {
        i++;
        continue;
      }
      // 
      throw new Error("Unknown token: [" +
        t.word + "] line " + t.no);
      i++;
      continue;
    }
  }
  // オブジェクトの詳細を得る
  function getObjectDesc(o) {
    var s = "";
    s += "[" + typeof(o) + "] ";
    if (typeof(JSON) != "undefined") {
      s += " " + JSON.stringify(o);
    }
    return s;
  }
  // 関数の実行
  function run_call_block(t, i, block) {
    var jo = {};
    jo.type = "call";
    jo.end_i = (i + 1);
    jo.next = function () { return this.end_i; }
    T.jumpStack.push(jo);
    var co = {};
    co.lvarTable = T.lvarTable;
    T.lvarTable = {};
    T.callStack.push(co);
    T.log("call: {callStack:" + T.callStack.length + "}");
    return block.block_begin;
  }
  function run_call(t, i) {
    var wt = run_pop();
    if (typeof(wt) != "object") {
      throw new Error("Invalid call : " +
        "Argument is not object line " + t.no);
    }
    if (wt.type == "block") {
      return run_call_block(t, i, wt);
    }
    if (wt.type == "word") {
      var v = run_getVar(wt.word);
      if (v.type == "block") {
        return run_call_block(t, i, v);
      }
      // JavaScript Object
      var a = v.word.split(".");
      var f = T.scope;
      for (var j = 0; j < a.length; j++) {
        f = f[a[j]];
      }
      if (typeof(f) == "function"||typeof(f) == "object") {
        // var v =f.apply(T.global, [run_pop()]);
        var v = f.call(T.global, run_pop());
        run_push(v);
        i++;
        return i;
      }
      throw new Error("Invalid js call : line " + t.no);
    }
    throw new Error("Invalid call : line " + t.no);
  }
  function run_getVar(word) {
    // check localvars
    var v = T.lvarTable[word];
    if (typeof(v) != "undefined") return v;
    // check callStack
    for (var i = T.callStack.length-1; i >= 0; i--) {
      var co = T.callStack[i];
      v = co.lvarTable[word];
      if (typeof(v) != "undefined") return v;
    }
    // check global
    v = T.varTable[word];
    return v;
  }
  function run_exit(t, mode) {
    if (T.jumpStack.length == 0) {
      throw new Error("jumpStack zero but found '}' line " + t.no);
    }
    T.log(" | - * run_exit=" + mode + ": line " + t.no);
    for (var i in T.stack) {
      var v = T.stack[i];
      var desc = getObjectDesc(v);
      T.log(" | - stack:" + i + ":" + desc);
    }
    var exit_call = function () {
      var co = T.callStack.pop();
      T.lvarTable = co.lvarTable;
      // for (var i in T.lvarTable) {
      //  print("["+i+"]="+T.lvarTable[i]);
      // }
    };
    var jo = null;
    if (mode == "block") {
      jo = T.jumpStack.pop();
      if (typeof(jo) != "object") throw new Error("Invalid '}' line " + t.no);
      if (jo.type == "call") exit_call();
    } else { // mode == "call"
      while (T.jumpStack.length > 0) {
        jo = T.jumpStack.pop();
        if (typeof(jo) != "object") throw new Error("Invalid exit line " + t.no);
        T.log(" | - stackPop) " + jo.type + " end_i=" + jo.end_i);
        if (jo.type != "call") continue;
        exit_call();
        break;
      }
    }
    return jo.next();
  }
  // operator
  function run_operator(t) {
    var v2 = run_pop();
    var v1 = run_pop();
    switch (t.word) {
      case "+": v3 = v1 + v2; break;
      case "-": v3 = v1 - v2; break;
      case "*": v3 = v1 * v2; break;
      case "/": v3 = v1 / v2; break;
      case "%": v3 = v1 % v2; break;
      case ">": v3 = (v1 > v2); break;
      case "<": v3 = (v1 < v2); break;
      case ">=": v3 = (v1 >= v2); break;
      case "<=": v3 = (v1 <= v2); break;
      case "=": v3 = (v1 == v2); break;
      case "==": v3 = (v1 == v2); break;
      case "!=": v3 = (v1 != v2); break;
      case "||": v3 = (v1 || v2); break;
      case "&&": v3 = (v1 && v2); break;
      default:
        throw new Error(
          "Unknown operator: [" + t.word + "] line " + t.no);
    }
    run_push(v3);
  }
  // ブロックを取得する
  function getBlockToken(tokens, i, t) {
    // キャッシュをチェック
    if (typeof(t.block_begin) == "number") return;
    var root_t = t;
    var level = 0;
    if (t.word == "{") {
      i++;
      level++;
    }
    root_t.block_begin = i;
    // ブロックの終端をチェック
    while (tokens.length > i) {
      t = tokens[i];
      if (t.word == "}") {
        level--;
        i++;
        if (level == 0) break;
        continue;
      }
      else if (t.word == "{") {
        level++;
        i++;
        continue;
      }
      i++;
    }
    root_t.block_end = i;
  }
})(this);
