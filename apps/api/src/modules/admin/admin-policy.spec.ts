import { permissionsFor, visibleAccounts } from './admin-policy';

const superAdmin = { userId: 'super', role: 'SUPER_ADMIN' as const };
const admin = { userId: 'admin', role: 'ADMIN' as const };
const user = { id: 'user', role: 'USER' as const };
const otherAdmin = { id: 'admin-2', role: 'ADMIN' as const };
const superTarget = { id: 'super', role: 'SUPER_ADMIN' as const };

const ALL = { editProfile: true, changeRole: true, resetPassword: true, block: true };
const NONE = { editProfile: false, changeRole: false, resetPassword: false, block: false };

describe('permissionsFor', () => {
  it('lets an admin manage users but not change roles', () => {
    expect(permissionsFor(admin, user)).toEqual({ ...ALL, changeRole: false });
  });

  it('gives admins view-only access to other admins', () => {
    expect(permissionsFor(admin, otherAdmin)).toEqual(NONE);
  });

  it('never lets an admin touch the super admin', () => {
    expect(permissionsFor(admin, superTarget)).toEqual(NONE);
  });

  it('lets the super admin manage users and admins, including roles', () => {
    expect(permissionsFor(superAdmin, user)).toEqual(ALL);
    expect(permissionsFor(superAdmin, otherAdmin)).toEqual(ALL);
  });

  it('never lets anyone change their own role or status', () => {
    expect(permissionsFor(admin, { id: 'admin', role: 'ADMIN' })).toEqual({ ...NONE, editProfile: true });
    expect(permissionsFor(superAdmin, superTarget)).toEqual({ ...NONE, editProfile: true });
  });
});

describe('visibleAccounts', () => {
  it('hides the super admin from admins only', () => {
    expect(visibleAccounts(admin)).toEqual({ role: { not: 'SUPER_ADMIN' } });
    expect(visibleAccounts(superAdmin)).toEqual({});
  });
});
