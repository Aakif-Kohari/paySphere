import PropTypes from 'prop-types';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

function TreeNode({ node, depth = 0 }) {
    return (
        <div className={`ml-${depth * 6} border-l-2 border-gray-200 dark:border-slate-700 pl-4 py-2`}>
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                <AccountTreeIcon className="text-brand-500" fontSize="small" />
                <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{node.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{node.ownerId?.fullName} • {node.overallProgress}%</p>
                </div>
                <div className="w-24 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-brand-600 h-2 rounded-full" style={{ width: `${node.overallProgress}%` }}></div>
                </div>
            </div>
            {node.children && node.children.length > 0 && (
                <div className="mt-2 space-y-2">
                    {node.children.map(child => <TreeNode key={child._id} node={child} depth={depth + 1} />)}
                </div>
            )}
        </div>
    );
}

TreeNode.propTypes = {
    node: PropTypes.object.isRequired,
    depth: PropTypes.number
};

export default function OkrTreeViewer({ tree }) {
    if (!tree || tree.length === 0) {
        return <p className="text-center text-gray-500 py-8">No OKR hierarchy found for this cycle.</p>;
    }

    return (
        <div className="space-y-4">
            {tree.map(root => <TreeNode key={root._id} node={root} />)}
        </div>
    );
}

OkrTreeViewer.propTypes = {
    tree: PropTypes.array.isRequired
};
