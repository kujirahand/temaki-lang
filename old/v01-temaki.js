#!/usr/bin/env rhino
// Temaki言語の定義を行う
(function (self) {
  if (typeof(self.Temaki) == "object") return;  
  var T = {};
  self.Temaki = T;
  // public method
  T.useDebug = false;
  T.scope = self;
  T.eval = function (source) {
    var tokens = tokenize(source);
    // debug
    for(var i = 0; i < tokens.length; i++) {
      T.log("-" + tokens[i].no + ":" + tokens[i].word);
    }
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
    source = source.split("\r\n").join("\n");
    source = source.split(":").join(" : ");
    var lines = source.split("\n");
    for (var no = 0; no < lines.length; no++) {
      var line = lines[no];
      var words = line.split(/\s+/);
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        w = w.replace(/^\s+/, ''); // trim left
        w = w.replace(/\s+$/, ''); // trim right
        if (w == "") continue;
        if (w.charAt(0) == "#") break; // line comment
        var t = {"no":no, "word": w};
        setTokenType(t);
        r.push(t);
      }
    }
    return r;
  }
  var TOKEN_OP = ["+","-","*","/","%",">",">=","<","<=","=","!="];
  // トークンタイプを判定する
  function setTokenType(t) {
    if (t.word == "." || t.word == "print") {
      t.type = "print";
      return;
    }
    if (t.word.match(/^[0-9\.]+$/)) {
      t.type = "number";
      t.value = parseFloat(t.word);
      return;
    }
    if (t.word.match(/^\".*\"$/)) {
      t.type = "string";
      t.value = t.word.substr(1, t.word.length - 2);
      return;
    }
    if (t.word.match(/^\'.*\'$/)) {
      t.type = "string";
      t.value = t.word.substr(1, t.word.length - 2);
      return;
    }
    for (var i in TOKEN_OP) {
      var w = TOKEN_OP[i];
      if (w == t.word) {
        t.type = "operator";
        return;
      }
    }
    if (t.word.match(/^\%{0,1}[A-Za-z0-9\.¥_¥-]+$/)) {
      t.type = "word";
      return;
    }
    if (t.word == ":") {
      t.type = "checker";
      return;
    }
    if (t.word == "{" || t.word == "}") {
      t.type = "block";
      return;
    }
    throw new Error("Invalid Token [" + t.word + "] line " + t.no);
  }
  //
  T.varTable = {};
  T.stack = [];
  T.jumpStack = [];
  // 実行する
  function run(tokens) {
    T.stack = [];
    run_tokens(tokens);
    var r = (T.stack.length > 0) ? T.stack[0] : null;
    return r;
  }
  function run_push(v) {
    T.stack.push(v);
    T.log(" - push) " + v);
  }
  function run_pop() {
    var v = T.stack.pop();
    T.log(" - pop-) " + v);
    return v;
  }
  function run_tokens(tokens) {
    var i = 0;
    while (i < tokens.length) {
      var t = tokens[i];
      T.log(" - run-) [" + i + "] " + t.word);
      // 値
      if (t.type == "number" || t.type == "string") {
        run_push(t.value);
        i++;
        continue;
      }
      // 計算
      if (t.type == "operator") {
        run_operator(t);
        i++;
        continue;
      }
      // 組み込み関数
      if (t.type == "print") {
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
        var value = T.varTable[name_t.word];
        run_push(value);
        i++;
        continue;
      }
      // inc
      if (t.word == "inc") {
        var name_t = run_pop();
        T.varTable[name_t.word]++;
        i++;
        continue;
      }
      if (t.word == "dec") {
        var name_t = run_pop();
        T.varTable[name_t.word]++;
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
        print("arr[" + index + "]=" + value);
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
        if (T.jumpStack.length == 0) {
          throw new Error("jumpStack zero but found '}' line " + t.no);
        }
        var new_i = T.jumpStack.pop();
        if (typeof(new_i) == "number") {
          i = new_i;
        } else {
          i = new_i.next();
        }
        continue;
      }
      // if
      if (t.word == "if") {
        var cond = run_pop();
        var true_block = run_pop();
        if (cond) {
          T.jumpStack.push(i+1);
          i = true_block.block_begin;
          continue;
        }
      }
      if (t.word == "ifelse") {
        var cond = run_pop();
        var false_block = run_pop();
        var true_block = run_pop();
        T.jumpStack.push(i+1);
        if (cond) {
          i = true_block.block_begin;
        } else {
          i = false_block.block_begin;
        }
        continue;
      }
      // for 
      if (t.word == "for") {
        var name = run_pop();
        var to_v = run_pop();
        var from_v = run_pop();
        var block_t = run_pop();
        // 変数チェック
        if (name["type"] !== "word") {
          throw new Error("for variable error line " + t.no);
        }
        // ジャンプ用のオブジェクトを生成
        var jo = {
          "name": name.word,
          "to_v": to_v,
          "from_v": from_v,
          "block_t": block_t,
          "end_i" : (i + 1)
        };
        jo.next = function () {
          var v = (++T.varTable[this.name]);
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
        T.varTable[jo.name] = jo.from_v;
        if (from_v > to_v) { // forを実行しない
          i++; continue; 
        }
        T.log("for-begin=" + from_v);
        T.jumpStack.push(jo);
        i = block_t.block_begin;
        continue;
      }
      // while 
      if (t.word == "while") {
        var cond = run_pop();
        var block = run_pop();
        if (cond) {
          i = block.block_begin;
          T.jumpStack.push(i - 1);
        } else {
          i++;
        }
        continue;
      }
      // call
      if (t.word == "call") {
        var wt = run_pop();
        if (wt.type == "word") {
          var v = T.varTable[wt.word];
          if (typeof(v) == "undefined") {
            // JavaScript Object
            var a = wt.word.split(".");
            var f = T.scope;
            for (var j = 0; j < a.length; j++) {
              f = f[a[j]];
            }
            if (typeof(f) == "function"||typeof(f) == "object") {
              // var v =f.apply(T.global, [run_pop()]);
              var v = f.call(T.global, run_pop());
              run_push(v);
              i++;
              continue;
            }
            throw new Error("Invalid js call : line " + t.no);
          }
          else if (v.type == "block") {
            wt = v;
          }
        }
        if (wt.type == "block") {
          T.jumpStack.push(i + 1);
          i = wt.block_begin;
          continue;
        }
        throw new Error("Invalid call : line " + t.no);
      }
      if (t.word == "jseval") {
        var src = run_pop();
        var r = eval(src);
        run_push(r);
        i++;
        continue;
      }
      // その他のワード(たぶん変数)
      if (t.type == "word") {
        if (t.word.charAt(0) == "%") { // 変数の値参照
          var name = t.word.substr(1);
          run_push(T.varTable[name]);
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
      case "!=": v3 = (v1 != v2); break;
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

/*
// 計算
print( Temaki.eval("1 2 3 * +") );
Temaki.eval("1 2 3 * + .");
// 変数
Temaki.eval("3 v1 set : v1 get print");
Temaki.eval(
  "array_new a set \n" +
  "a get 0 100 array_set \n" +
  "a get 0 array_get print");
Temaki.eval(
  "{ 'ok:if' print } 5 3 > if"
);
Temaki.eval("{ 'ok' print } { 'ng' print } 3 5 > ifelse");
Temaki.eval("10 v1 set : v1 inc v1 get print");
// 1 - 10までを順に加算 55
Temaki.eval(
  "0 kei set\n" +
  "1 i set\n" +
  "{ kei get i get + kei set : i inc } i get 10 <= while\n" +
  "kei get print");
Temaki.eval("{ i get print } 1 10 i for");
Temaki.eval(
  "0 kei set\n" +
  "{ kei get i get + kei set } 1 10 i for\n" +
  "kei get print");
*/

