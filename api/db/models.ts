export type Metadata = {
  createdAt: Date,
  updatedAt: Date
};

export type Todo = {
  id: number,
  imgUrl?: string,
  title: string,
  description?: string,
  done: boolean,
  createdBy: number,
  assignees: User[],
  metadata: Metadata
};

export type UserProfile = {
  id: number,
  imgUrl?: string,
  description?: string,
  userId: number,
};

export type User = {
  id: number,
  name: string,
  profileId: number,
  teamId: number,
  sessionId: number,
  email: string,
  passwordHash: string,
};

export type Team = {
  id: number,
  name: string,
  members: User[],
  todos: Todo[],
  ownerId: number
};

export type Session = {
  id: number,
  expiresAt: Date
};

export type Permission = {
  id: number,
  name: string,
};

export type Role = {
  id: number,
  name: string,
  permissions: Permission[]
};

export type DB = {
  todos: Todo[],
  users: User[],
  teams: Team[],
  roles: Role[],
  permissions: Permission[],
  sessions: Session[]
};
