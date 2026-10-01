import type { AdminCardDetail, AdminUserDetail } from '@card-trader/shared';
import {
  adminUserActions,
  cardFormFrom,
  diffCard,
  diffUser,
  diffVendor,
  hasAnyAction,
  userFormFrom,
  validateBroadcast,
  validateCardForm,
  validateCreateAdmin,
  validateNewPassword,
  validateUserForm,
  validateVendorForm,
  vendorFormFrom,
} from '../features/admin/adminForm';
import {
  auditActionLabel,
  auditActorText,
  auditChangeLines,
  auditQueryFor,
  auditValue,
  signInMethodsText,
} from '../features/admin/adminText';

const user = {
  publicId: 'AbCdEfGhIjKl',
  email: 'tom@example.com',
  role: 'USER',
  status: 'ACTIVE',
  username: 'tom',
  displayName: 'Tom',
  bio: null,
  avatarUrl: 'https://cdn.example.com/a.png',
  location: 'Austin',
  socialLinks: { instagram: '@tom' },
  vendor: {
    isActive: true,
    businessName: 'Tom’s Cards',
    logoUrl: null,
    logoKey: null,
    description: null,
    website: 'https://tom.example.com',
    socialLinks: {},
  },
} as unknown as AdminUserDetail;

describe('admin user form', () => {
  it('sends nothing (not even the reason) when nothing changed', () => {
    expect(diffUser(user, userFormFrom(user), 'just looking')).toEqual({});
    expect(diffVendor(user.vendor!, vendorFormFrom(user.vendor!), 'x')).toEqual({});
  });

  it('sends only changed fields, normalized', () => {
    const form = { ...userFormFrom(user), username: ' @Tom_2 ', bio: '  ', location: '', socialLinks: { instagram: '@tom', x: ' @t ' } };
    expect(diffUser(user, form, ' spam ')).toEqual({
      username: 'tom_2',
      location: null,
      socialLinks: { instagram: '@tom', x: '@t' },
      reason: 'spam',
    });
    expect(diffUser(user, { ...userFormFrom(user), email: 'TOM@example.com ' }, '')).toEqual({});
    expect(diffUser(user, { ...userFormFrom(user), removeAvatar: true }, '')).toEqual({ removeAvatar: true });
  });

  it('diffs the vendor profile separately', () => {
    const form = { ...vendorFormFrom(user.vendor!), isActive: false, website: '', removeLogo: true };
    // no logo to remove, so removeLogo is not sent
    expect(diffVendor(user.vendor!, form, '')).toEqual({ isActive: false, website: null });
  });

  it('validates against the API limits', () => {
    const base = userFormFrom(user);
    expect(validateUserForm(base)).toEqual({});
    expect(Object.keys(validateUserForm({ ...base, email: 'nope', username: 'a', displayName: 'T', bio: 'x'.repeat(281) })).sort()).toEqual([
      'bio',
      'displayName',
      'email',
      'username',
    ]);
    expect(validateVendorForm({ ...vendorFormFrom(user.vendor!), businessName: 'T', website: 'tom.example.com' })).toEqual({
      businessName: expect.any(String),
      website: expect.any(String),
    });
  });

});

describe('admin account actions', () => {
  const all = { editProfile: true, changeRole: true, resetPassword: true, block: true };
  const none = { editProfile: false, changeRole: false, resetPassword: false, block: false };

  it('shows exactly what the permissions allow', () => {
    expect(adminUserActions({ role: 'USER', status: 'ACTIVE', permissions: all })).toEqual({
      edit: true,
      changeRoleTo: 'ADMIN',
      resetPassword: true,
      block: true,
      unblock: false,
    });
    const nothing = adminUserActions({ role: 'ADMIN', status: 'ACTIVE', permissions: none });
    expect(nothing).toEqual({ edit: false, changeRoleTo: null, resetPassword: false, block: false, unblock: false });
    expect(hasAnyAction(nothing)).toBe(false);
  });

  it('flips role and block actions with the current state', () => {
    expect(adminUserActions({ role: 'ADMIN', status: 'BLOCKED', permissions: all })).toMatchObject({ changeRoleTo: 'USER', block: false, unblock: true });
    // a normal admin (no changeRole) can still block a user
    expect(adminUserActions({ role: 'USER', status: 'BLOCKED', permissions: { ...all, changeRole: false } })).toMatchObject({
      changeRoleTo: null,
      unblock: true,
    });
    // nobody is offered a role change on the super admin, and disabled accounts get neither block nor unblock
    expect(adminUserActions({ role: 'SUPER_ADMIN', status: 'ACTIVE', permissions: all }).changeRoleTo).toBeNull();
    expect(adminUserActions({ role: 'USER', status: 'DISABLED', permissions: all })).toMatchObject({ block: false, unblock: false });
  });
});

describe('admin password and admin forms', () => {
  it('requires 10–128 characters and a matching confirmation', () => {
    expect(validateNewPassword('short', 'short')).toEqual({ password: expect.any(String) });
    expect(validateNewPassword('x'.repeat(129), 'x'.repeat(129))).toEqual({ password: expect.any(String) });
    expect(validateNewPassword('long-enough-1', 'long-enough-2')).toEqual({ confirm: 'Passwords don’t match' });
    expect(validateNewPassword('long-enough-1', 'long-enough-1')).toEqual({});
  });

  it('validates a new admin and an announcement', () => {
    const admin = { email: 'ann@example.com', username: 'ann', displayName: 'Ann', password: 'temporary-pass', confirm: 'temporary-pass' };
    expect(validateCreateAdmin(admin)).toEqual({});
    expect(Object.keys(validateCreateAdmin({ ...admin, email: 'x', confirm: 'other' })).sort()).toEqual(['confirm', 'email']);
    expect(validateBroadcast('Hi', 'ok')).toEqual({ title: expect.any(String), message: expect.any(String) });
    expect(validateBroadcast('Maintenance', 'Back at 9 PM.')).toEqual({});
    expect(validateBroadcast('Maintenance', 'x'.repeat(301)).message).toBeDefined();
  });
});

describe('admin card form', () => {
  const card = { id: 'c1', name: 'Charizard', cardNumber: '4', variant: '', subject: null, rarity: 'Holo', imageUrl: null } as unknown as AdminCardDetail;

  it('diffs and validates card edits', () => {
    expect(diffCard(card, cardFormFrom(card), 'x')).toEqual({});
    expect(diffCard(card, { ...cardFormFrom(card), variant: 'Shadowless', rarity: ' ', imageUrl: 'https://img.example.com/c.png' }, 'typo')).toEqual({
      variant: 'Shadowless',
      rarity: null,
      imageUrl: 'https://img.example.com/c.png',
      reason: 'typo',
    });
    expect(Object.keys(validateCardForm({ ...cardFormFrom(card), name: ' ', imageUrl: 'ftp://x' })).sort()).toEqual(['imageUrl', 'name']);
  });
});

describe('audit text', () => {
  it('formats actions and changes', () => {
    expect(auditActionLabel('USER_DISABLED')).toBe('User blocked');
    expect(auditActionLabel('USER_ENABLED')).toBe('User unblocked');
    expect(auditActionLabel('USER_PASSWORD_RESET')).toBe('Password reset');
    expect(auditActionLabel('ADMIN_ROLE_CHANGED')).toBe('Made admin');
    expect(auditActionLabel('ADMIN_REMOVED')).toBe('Admin role removed');
    expect(auditActionLabel('ANNOUNCEMENT_SENT')).toBe('Announcement sent');
    expect(auditActionLabel('CARD_MERGED')).toBe('Card merged');
    expect(auditActorText({ admin: { publicId: null, displayName: 'Hidden', email: null } })).toBe('Administrator');
    expect(auditActorText({ admin: { publicId: 'p1', displayName: 'Ann', email: 'ann@example.com' } })).toBe('Ann');
    expect(auditQueryFor('all')).toEqual({});
    expect(auditQueryFor('passwords')).toEqual({ action: 'USER_PASSWORD_RESET' });
    expect(auditQueryFor('announcements')).toEqual({ targetType: 'SYSTEM' });
    expect(signInMethodsText(['PASSWORD', 'GOOGLE'])).toBe('Password, Google');
    expect(auditValue(null)).toBe('—');
    expect(auditValue(true)).toBe('yes');
    expect(auditValue({ x: '@t' })).toBe('{"x":"@t"}');
    expect(auditChangeLines({ changes: { status: { from: 'ACTIVE', to: 'BLOCKED' }, bio: { from: null, to: 'Hi' } } })).toEqual([
      'status: ACTIVE → BLOCKED',
      'bio: — → Hi',
    ]);
  });
});
