export interface IUserService {
  getUserById(userId: string): Promise<any>;
  updateProfile(userId: string, data: { name?: string; image?: string }): Promise<any>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  listUsers(params: {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<any>;
  lockAccount(userId: string): Promise<void>;
  unlockAccount(userId: string): Promise<void>;
}
