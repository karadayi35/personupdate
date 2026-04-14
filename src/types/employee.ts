export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'personnel';
  branchId: string;
  branchName?: string;
  avatar?: string;
  status: 'active' | 'inactive';
  createdAt: any;
}
