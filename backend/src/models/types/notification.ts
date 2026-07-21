export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  data: any;
  created_at: Date;
}

export interface CreateNotification {
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
}
