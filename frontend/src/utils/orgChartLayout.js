/**
 * @fileoverview Organizational Chart Layout Algorithm
 * @description Implements a layered tree layout algorithm (simplified Reingold-Tilford)
 * to calculate X/Y coordinates for nodes and bezier control points for edges.
 * 
 * Issue: #816
 */

/**
 * Node dimensions and spacing constants
 */
export const LAYOUT_CONFIG = {
    NODE_WIDTH: 200,
    NODE_HEIGHT: 80,
    HORIZONTAL_SPACING: 40, // Gap between sibling nodes
    VERTICAL_SPACING: 80,   // Gap between hierarchy levels
    PADDING: 50,            // Canvas edge padding
};

/**
 * Builds a tree structure from a flat array of employees
 * @param {Array} employees - Flat array of employee objects with `id`, `name`, `role`, `managerId`
 * @returns {Object} Tree root node and flat map of all nodes
 */
export function buildTree(employees) {
    const nodeMap = new Map();
    const roots = [];

    // Initialize nodes
    employees.forEach(emp => {
        nodeMap.set(emp._id || emp.id, {
            id: emp._id || emp.id,
            name: emp.fullName || emp.name,
            role: emp.role || 'Employee',
            department: emp.department || '',
            children: [],
            x: 0,
            y: 0,
            width: LAYOUT_CONFIG.NODE_WIDTH,
            height: LAYOUT_CONFIG.NODE_HEIGHT,
        });
    });

    // Link children to parents
    employees.forEach(emp => {
        const node = nodeMap.get(emp._id || emp.id);
        const managerId = emp.managerId || emp.reportsTo;

        if (managerId && nodeMap.has(managerId)) {
            nodeMap.get(managerId).children.push(node);
        } else {
            roots.push(node); // No manager = root node
        }
    });

    // If multiple roots, create a virtual root to unify the tree
    if (roots.length > 1) {
        const virtualRoot = {
            id: 'virtual-root',
            name: 'Organization',
            role: 'Company',
            children: roots,
            x: 0,
            y: 0,
            width: LAYOUT_CONFIG.NODE_WIDTH,
            height: LAYOUT_CONFIG.NODE_HEIGHT,
            isVirtual: true,
        };
        return { root: virtualRoot, nodeMap };
    }

    return { root: roots[0] || null, nodeMap };
}

/**
 * Calculates the width of a subtree (used for positioning)
 * @param {Object} node - Tree node
 * @returns {number} Total width required by this subtree
 */
function getSubtreeWidth(node) {
    if (!node.children || node.children.length === 0) {
        return node.width;
    }

    let totalWidth = 0;
    node.children.forEach((child, index) => {
        totalWidth += getSubtreeWidth(child);
        if (index < node.children.length - 1) {
            totalWidth += LAYOUT_CONFIG.HORIZONTAL_SPACING;
        }
    });

    return Math.max(node.width, totalWidth);
}

/**
 * Assigns X and Y coordinates to all nodes in the tree
 * @param {Object} node - Current node being positioned
 * @param {number} x - Starting X coordinate for this subtree
 * @param {number} y - Y coordinate for this level
 */
export function layoutTree(node, x = 0, y = 0) {
    if (!node) return;

    const subtreeWidth = getSubtreeWidth(node);

    // Center this node over its subtree
    node.x = x + (subtreeWidth - node.width) / 2;
    node.y = y;

    if (node.children && node.children.length > 0) {
        let currentX = x;
        const childY = y + node.height + LAYOUT_CONFIG.VERTICAL_SPACING;

        node.children.forEach((child, index) => {
            const childWidth = getSubtreeWidth(child);
            layoutTree(child, currentX, childY);
            currentX += childWidth + LAYOUT_CONFIG.HORIZONTAL_SPACING;
        });
    }
}

/**
 * Calculates the bounding box of the entire tree
 * @param {Object} root - Root node
 * @returns {Object} { minX, minY, maxX, maxY, width, height }
 */
export function getTreeBounds(root) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    function traverse(node) {
        if (!node) return;
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);

        if (node.children) {
            node.children.forEach(traverse);
        }
    }

    traverse(root);

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
}
