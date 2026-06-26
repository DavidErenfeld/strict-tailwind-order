function isStaticStringNode(node) {
  if (!node) return false
  if ((node.type === 'Literal' || node.type === 'StringLiteral' || node.type === 'VLiteral') && typeof node.value === 'string') return true
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return true
  return false
}

function getCallName(node) {
  if (!node || node.type !== 'CallExpression') return null
  if (node.callee.type === 'Identifier') return node.callee.name
  if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.type === 'Identifier') {
    return node.callee.property.name
  }
  return null
}

function collectObjectPropertyClassKeys(property, output, seen, functions) {
  if (!property) return

  if (property.type === 'SpreadElement' || property.type === 'ExperimentalSpreadProperty') {
    collectClassStrings(property.argument, output, seen, functions)
    return
  }

  if (property.type !== 'Property' && property.type !== 'ObjectProperty') return
  if (property.kind && property.kind !== 'init') return

  if (isStaticStringNode(property.key)) {
    output.push(property.key)
    return
  }

  if (property.computed) {
    collectClassStrings(property.key, output, seen, functions)
  }
}

function collectClassStrings(node, output, seen, functions) {
  if (!node || seen.has(node)) return
  seen.add(node)

  if (isStaticStringNode(node)) {
    output.push(node)
    return
  }

  switch (node.type) {
    case 'ArrayExpression':
      for (const element of node.elements || []) collectClassStrings(element, output, seen, functions)
      return
    case 'SpreadElement':
    case 'ExperimentalSpreadProperty':
      collectClassStrings(node.argument, output, seen, functions)
      return
    case 'ConditionalExpression':
      collectClassStrings(node.consequent, output, seen, functions)
      collectClassStrings(node.alternate, output, seen, functions)
      return
    case 'LogicalExpression':
      collectClassStrings(node.right, output, seen, functions)
      return
    case 'CallExpression': {
      const name = getCallName(node)
      if (!name || !functions.has(name)) return
      for (const argument of node.arguments || []) collectClassStrings(argument, output, seen, functions)
      return
    }
    case 'ObjectExpression':
      for (const property of node.properties || []) collectObjectPropertyClassKeys(property, output, seen, functions)
      return
    case 'SequenceExpression':
      for (const expression of node.expressions || []) collectClassStrings(expression, output, seen, functions)
      return
    case 'ChainExpression':
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'TSInstantiationExpression':
      collectClassStrings(node.expression, output, seen, functions)
      return
    default:
      return
  }
}

module.exports = {
  collectClassStrings,
  getCallName,
  isStaticStringNode
}
