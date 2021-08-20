// 读取文件
const fs = require('fs')
// 解决路径问题
const path = require('path')
// 转换语法树
const parser = require('@babel/parser')
// 分析依赖
const traverse = require('@babel/traverse').default
// 核心包（ES6转换ES5）
const babel = require("@babel/core")

/**
 * 模块分析
 * @param {*} file 
 */
function getModuleInfo(file) {
  // 1、读取文件
  const body = fs.readFileSync(file,'utf-8')

  // 2、转换AST语法树
  const ast = parser.parse(body,{
    sourceType:"module",//表示解析ES模块
  })
  // console.log('ast',ast);

  // 3、依赖收集
  const deps = {}
  traverse(ast,{
    ImportDeclaration({node}) {
      // 相对路径
      const dirname = path.dirname(file)
      // 绝对路径
      const abspath = './' + path.join(dirname,node.source.value)
      deps[node.source.value] = abspath;
    }
  })
  // console.log('deps',deps);

  // 4、ES6转ES5
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  })

  const moduleInfo = { file,deps,code };
  return moduleInfo
}

// 单个模块
// const info = getModuleInfo('./src/index.js')
// console.log("info:",info)

/**
 * 多模块解析
 * @param {*} file 
 */
function parseModules(file) {
  // 从入口模块开始
  const entry = getModuleInfo(file)
  // 将解析出来的单个内容放在一个数组内
  const temp = [entry]
  // 构建依赖关系图
  const depsGraph = {}
  getDeps(temp,entry)

  // 组装依赖关系图
  temp.forEach((moduleInfo) => {
    depsGraph[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code: moduleInfo.code
    }
  })

  return depsGraph
}

/**
 * 构建单个依赖关系（递归）
 * @param {*} temp 
 * @param {*} param1 
 */
function getDeps(temp,{deps}) {
  Object.keys(deps).forEach((key) => {
    const child = getModuleInfo(deps[key])
    temp.push(child)
    // 递归解析依赖
    getDeps(temp,child)
  })
}

// const graph = parseModules('./src/index.js')
// console.log(graph);

/**
 * 输出打包内容
 * @param {*} file 
 * @returns 
 */
function bundle(file) {
  // 调用多模块依赖构建方法
  const depsGraph = JSON.stringify(parseModules(file))
  // 拼接用于打包的自执行函数，将依赖图作为参数传入
  return `(function (graph) {
    function require(file) {
    function absRequire(relPath) {
    return require(graph[file].deps[relPath])
    }
    var exports = {};
    (function (require,exports,code) {
    eval(code)
    })(absRequire,exports,graph[file].code)
    return exports
    }
    require('${file}')
    })(${depsGraph})`;
}

const content = bundle('./src/index.js')
// console.log(content);
//判断dist文件夹是否存在
!fs.existsSync('./dist') && fs.mkdirSync('./dist')
//将打包后的内容输出在dist/bundle.js文件中
fs.writeFileSync('./dist/bundle.js',content)