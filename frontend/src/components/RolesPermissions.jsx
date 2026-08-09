/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useState } from 'react';
import api from '../services/api';

const getErrorMessage = (err) =>
  err.response?.data?.message || 'Something went wrong. Please try again.';

const permissionNamesOf = (role) =>
  (role?.permissions || [])
    .map((p) => (typeof p === 'string' ? p : p.name))
    .filter(Boolean);

const LockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

/**
 * Custom role management (#475).
 *
 * Renders the permission matrix: every role against every permission, with
 * system roles locked (the seeder owns them and the backend refuses to touch
 * them) and custom roles freely editable via direct matrix toggles or the
 * create/edit form.
 */
export default function RolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // role or null
  const [formName, setFormName] = useState('');
  const [formPermissions, setFormPermissions] = useState([]); // names
  const [formError, setFormError] = useState('');

  const loadRoles = () => {
    setLoading(true);
    api
      .get('/api/roles')
      .then((res) => {
        setRoles(res.data?.roles || []);
        setPermissions(res.data?.permissions || []);
      })
      .catch((err) => alert(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setFormName('');
    setFormPermissions([]);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormPermissions(permissionNamesOf(role));
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingRole(null);
    setFormError('');
  };

  const toggleFormPermission = (name) => {
    setFormPermissions((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    );
  };

  const saveRole = async () => {
    setFormError('');
    if (!formName.trim()) {
      setFormError('Role name is required.');
      return;
    }
    if (formPermissions.length === 0) {
      setFormError('Select at least one permission.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        permissions: formPermissions,
      };
      if (editingRole) {
        await api.patch(`/api/roles/${editingRole._id}`, payload);
        alert('Role updated successfully!');
      } else {
        await api.post('/api/roles', payload);
        alert('Role created successfully!');
      }
      closeForm();
      loadRoles();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = async (role, permission) => {
    if (role.isSystem) return;
    const current = permissionNamesOf(role);
    const next = current.includes(permission.name)
      ? current.filter((p) => p !== permission.name)
      : [...current, permission.name];
    try {
      await api.patch(`/api/roles/${role._id}`, { permissions: next });
      loadRoles();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const deleteRole = async (role) => {
    if (role.isSystem) return;
    if (!window.confirm(`Delete the "${role.name}" role?\n\nAccounts holding this role will lose it immediately.`))
      return;
    try {
      await api.delete(`/api/roles/${role._id}`);
      loadRoles();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Roles &amp; Permissions
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Define what each account can do. Custom roles are editable; system
            roles are locked and managed by PaySphere.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          Add Role
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
      {formOpen && (
        <div className="p-6 border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-5">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {editingRole ? 'Edit Role' : 'New Role'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
              Permission names are stored as-is; the backend validates them
              against the permission catalog.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
              Role Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Payroll Manager"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 outline-none text-sm text-gray-900 dark:text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
              Permissions
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {permissions.map((permission) => (
                <label
                  key={permission.name}
                  className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition ${
                    formPermissions.includes(permission.name)
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
                      : 'bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formPermissions.includes(permission.name)}
                    onChange={() => toggleFormPermission(permission.name)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-700 dark:text-slate-200">
                      {permission.name}
                    </span>
                    {permission.description && (
                      <span className="block text-xs text-gray-500 dark:text-slate-500">
                        {permission.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500 font-medium">{formError}</p>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={closeForm}
              className="px-5 py-2.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-bold transition hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={saveRole}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                saving
                  ? 'bg-blue-300 dark:bg-blue-900/50 text-white/70 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 dark:shadow-none'
              }`}
            >
              {saving ? 'Saving…' : editingRole ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </div>
      )}

      {/* ── Permission matrix ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : roles.length === 0 ? (
        <div className="p-12 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-center">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
            No roles yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-500 mb-4">
            Create your first role to start granting permissions.
          </p>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition"
          >
            Add your first role
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-sm min-w-max">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50">
                <th className="py-3 pl-5 pr-4 font-bold">Role</th>
                {permissions.map((permission) => (
                  <th
                    key={permission.name}
                    className="py-3 px-4 font-bold text-center"
                    title={permission.description}
                  >
                    {permission.name}
                  </th>
                ))}
                <th className="py-3 pl-4 pr-5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const held = new Set(permissionNamesOf(role));
                return (
                  <tr
                    key={role._id}
                    className="border-b border-gray-100 dark:border-slate-800 last:border-0"
                  >
                    <td className="py-3 pl-5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {role.name}
                        </span>
                        {role.isSystem && (
                          <span
                            title="System role — managed by PaySphere"
                            className="text-amber-500 dark:text-amber-400"
                          >
                            <LockIcon />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                        {role.isSystem ? 'System' : 'Custom'} ·{' '}
                        {role.userCount || 0} user(s)
                      </p>
                    </td>
                    {permissions.map((permission) => (
                      <td key={permission.name} className="py-3 px-4 text-center">
                        {role.isSystem ? (
                          <span
                            className={`inline-block w-4 h-4 rounded ${
                              held.has(permission.name)
                                ? 'bg-amber-400 dark:bg-amber-500'
                                : 'bg-gray-200 dark:bg-slate-700'
                            }`}
                          ></span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={held.has(permission.name)}
                            onChange={() => togglePermission(role, permission)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        )}
                      </td>
                    ))}
                    <td className="py-3 pl-4 pr-5 text-right whitespace-nowrap">
                      {!role.isSystem && (
                        <>
                          <button
                            onClick={() => openEdit(role)}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRole(role)}
                            disabled={role.userCount > 0}
                            className={`text-xs font-semibold hover:underline ${
                              role.userCount > 0
                                ? 'text-gray-400 dark:text-slate-600 cursor-not-allowed'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                            title={
                              role.userCount > 0
                                ? 'Reassign accounts before deleting'
                                : 'Delete role'
                            }
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
