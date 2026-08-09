class ASTEvaluator {
  static evaluate(node, context) {
    if (node.type === 'Literal') return node.value;
    if (node.type === 'Identifier') return context[node.name];
    // Recursive evaluation logic
    return 0;
  }
}
module.exports = ASTEvaluator;
