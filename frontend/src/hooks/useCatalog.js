import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FALLBACK_DEPARTMENTS, FALLBACK_ROLES } from '../utils/catalog';

export function useCatalog() {
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS);
  const [roles, setRoles] = useState(FALLBACK_ROLES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [deptRes, roleRes] = await Promise.all([
        axios.get('/api/catalog/departments'),
        axios.get('/api/catalog/roles'),
      ]);
      if (Array.isArray(deptRes.data) && deptRes.data.length) {
        setDepartments(deptRes.data);
      }
      if (Array.isArray(roleRes.data) && roleRes.data.length) {
        setRoles(roleRes.data);
      }
    } catch (err) {
      console.warn('useCatalog:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { departments, roles, loading, refresh };
}
