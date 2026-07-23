import { getDB, saveDB, getNextId } from './helpers.ts';
import type { User, Permission, Session, Role, Todo, Team } from './models.ts';

export const ensureUserExists = (users: User[], userId: number, context?: string): void => {
  const exists = users.some(u => u.id === userId);
  if (!exists) {
    throw new Error(`User with id ${userId} not found.${context ? ` (${context})` : ''}`);
  }
};

export const ensureTeamExists = (teams: Team[], teamId: number): void => {
  const exists = teams.some(t => t.id === teamId);
  if (!exists) {
    throw new Error(`Team with id ${teamId} not found.`);
  }
};

const ensurePermissionExists = (permissions: Permission[], permissionId: number): void => {
  const exists = permissions.some(p => p.id === permissionId);
  if (!exists) {
    throw new Error(`Permission with id ${permissionId} not found.`);
  }
};

const ensureRoleExists = (roles: Role[], roleId: number): void => {
  const exists = roles.some(r => r.id === roleId);
  if (!exists) {
    throw new Error(`Role with id ${roleId} not found.`);
  }
};

const ensureSessionExists = (sessions: Session[], sessionId: number): void => {
  const exists = sessions.some(s => s.id === sessionId);
  if (!exists) {
    throw new Error(`Session with id ${sessionId} not found.`);
  }
};

// ---- CRUD for Users ----

export const createUser = async (
  dbPath: string | URL,
  data: Omit<User, 'id'>
): Promise<User> => {
  const db = await getDB(dbPath);

  // Validate foreign keys
  ensureTeamExists(db.teams, data.teamId);
  ensureSessionExists(db.sessions, data.sessionId);

  // Ensure profileId uniqueness? The schema suggests UserProfile.userId links back,
  // but we're creating a User first; profileId can be assigned later. For simplicity,
  // we allow creating a user with profileId = 0 or undefined and later tie it.
  // Here we'll require profileId to be 0 (meaning no profile yet) or a valid profile?
  // There's no Profile type in the array, so we skip.

  const newUser: User = {
    id: getNextId(db.users),
    ...data,
  };
  db.users.push(newUser);
  await saveDB(dbPath, db);
  return newUser;
};

export const getUserById = async (dbPath: string | URL, id: number): Promise<User> => {
  const db = await getDB(dbPath);
  const user = db.users.find(u => u.id === id);
  if (!user) {
    throw new Error(`User not found with id ${id}`);
  }
  return user;
};

export const updateUser = async (
  dbPath: string | URL,
  id: number,
  updates: Partial<Omit<User, 'id'>>
): Promise<User> => {
  const db = await getDB(dbPath);
  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    throw new Error(`User not found with id ${id}`);
  }

  // Validate foreign keys if they are being updated
  if (updates.teamId !== undefined) {
    ensureTeamExists(db.teams, updates.teamId);
  }
  if (updates.sessionId !== undefined) {
    ensureSessionExists(db.sessions, updates.sessionId);
  }

  db.users[userIndex] = { ...db.users[userIndex], ...updates };
  await saveDB(dbPath, db);
  return db.users[userIndex];
};

export const deleteUser = async (dbPath: string | URL, id: number): Promise<void> => {
  const db = await getDB(dbPath);
  const userIndex = db.users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    throw new Error(`User not found with id ${id}`);
  }

  // Optionally remove references in other entities (e.g., from Team.members, Todo.assignees)
  // For simplicity, we remove the user from any team they belong to.
  db.teams.forEach(team => {
    team.members = team.members.filter(m => m.id !== id);
  });

  // Remove user from assignees in todos
  db.todos.forEach(todo => {
    todo.assignees = todo.assignees.filter(a => a.id !== id);
  });

  db.users.splice(userIndex, 1);
  await saveDB(dbPath, db);
};

// ---- CRUD for Teams ----

export const createTeam = async (
  dbPath: string | URL,
  data: Omit<Team, 'id' | 'members' | 'todos'>
): Promise<Team> => {
  const db = await getDB(dbPath);
  ensureUserExists(db.users, data.ownerId, 'createTeam ownerId');

  const newTeam: Team = {
    id: getNextId(db.teams),
    name: data.name,
    ownerId: data.ownerId,
    members: [],
    todos: [],
  };
  db.teams.push(newTeam);
  await saveDB(dbPath, db);
  return newTeam;
};

export const getTeamById = async (dbPath: string | URL, id: number): Promise<Team> => {
  const db = await getDB(dbPath);
  const team = db.teams.find(t => t.id === id);
  if (!team) {
    throw new Error(`Team not found with id ${id}`);
  }
  return team;
};

export const updateTeam = async (
  dbPath: string | URL,
  id: number,
  updates: Partial<Pick<Team, 'name' | 'ownerId'>>
): Promise<Team> => {
  const db = await getDB(dbPath);
  const teamIndex = db.teams.findIndex(t => t.id === id);
  if (teamIndex === -1) {
    throw new Error(`Team not found with id ${id}`);
  }

  if (updates.ownerId !== undefined) {
    ensureUserExists(db.users, updates.ownerId, 'updateTeam ownerId');
  }

  db.teams[teamIndex] = { ...db.teams[teamIndex], ...updates };
  await saveDB(dbPath, db);
  return db.teams[teamIndex];
};

export const deleteTeam = async (dbPath: string | URL, id: number): Promise<void> => {
  const db = await getDB(dbPath);
  const teamIndex = db.teams.findIndex(t => t.id === id);
  if (teamIndex === -1) {
    throw new Error(`Team not found with id ${id}`);
  }

  // Remove reference from all users that belong to this team (set teamId to 0 or delete)
  db.users.forEach(user => {
    if (user.teamId === id) {
      user.teamId = 0; // or could delete user; design choice
    }
  });

  // Remove or orphan todos that belong to this team?
  // Since Team.todos is a reference, we'll delete those todos as well.
  db.todos = db.todos.filter(todo => {
    // Check if this todo belongs to the team (via Team.todos reference) 
    // Not directly stored, so we need to check using the team's list.
    // Instead, we filter todos that are not in the team's todo list.
    const team = db.teams[teamIndex];
    const isTeamTodo = team.todos.some(t => t.id === todo.id);
    return !isTeamTodo;
  });

  db.teams.splice(teamIndex, 1);
  await saveDB(dbPath, db);
};

// Helper to add a user to a team
export const addUserToTeam = async (
  dbPath: string | URL,
  teamId: number,
  userId: number
): Promise<void> => {
  const db = await getDB(dbPath);
  const team = db.teams.find(t => t.id === teamId);
  if (!team) throw new Error(`Team not found with id ${teamId}`);
  const user = db.users.find(u => u.id === userId);
  if (!user) throw new Error(`User not found with id ${userId}`);

  // Prevent duplicates
  if (team.members.some(m => m.id === userId)) {
    throw new Error(`User ${userId} is already a member of team ${teamId}`);
  }

  team.members.push(user);
  // Also update user's teamId
  user.teamId = teamId;
  await saveDB(dbPath, db);
};

// Helper to remove a user from a team
export const removeUserFromTeam = async (
  dbPath: string | URL,
  teamId: number,
  userId: number
): Promise<void> => {
  const db = await getDB(dbPath);
  const team = db.teams.find(t => t.id === teamId);
  if (!team) throw new Error(`Team not found with id ${teamId}`);

  const userIndex = team.members.findIndex(m => m.id === userId);
  if (userIndex === -1) {
    throw new Error(`User ${userId} is not a member of team ${teamId}`);
  }

  team.members.splice(userIndex, 1);
  // Reset user's teamId
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.teamId = 0;
  }
  await saveDB(dbPath, db);
};

// ---- CRUD for Todos ----

export const createTodo = async (
  dbPath: string | URL,
  data: Omit<Todo, 'id' | 'metadata' | 'assignees'>
): Promise<Todo> => {
  const db = await getDB(dbPath);
  ensureUserExists(db.users, data.createdBy, 'createTodo createdBy');

  const newTodo: Todo = {
    id: getNextId(db.todos),
    title: data.title,
    description: data.description,
    done: data.done ?? false,
    createdBy: data.createdBy,
    imgUrl: data.imgUrl,
    assignees: [],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  db.todos.push(newTodo);
  await saveDB(dbPath, db);
  return newTodo;
};

export const getTodoById = async (dbPath: string | URL, id: number): Promise<Todo> => {
  const db = await getDB(dbPath);
  const todo = db.todos.find(t => t.id === id);
  if (!todo) {
    throw new Error(`Todo not found with id ${id}`);
  }
  return todo;
};

export const updateTodo = async (
  dbPath: string | URL,
  id: number,
  updates: Partial<Omit<Todo, 'id' | 'metadata' | 'assignees'>>
): Promise<Todo> => {
  const db = await getDB(dbPath);
  const todoIndex = db.todos.findIndex(t => t.id === id);
  if (todoIndex === -1) {
    throw new Error(`Todo not found with id ${id}`);
  }

  // Validate foreign key if updated
  if (updates.createdBy !== undefined) {
    ensureUserExists(db.users, updates.createdBy, 'updateTodo createdBy');
  }

  db.todos[todoIndex] = {
    ...db.todos[todoIndex],
    ...updates,
    metadata: {
      ...db.todos[todoIndex].metadata,
      updatedAt: new Date(),
    },
  };
  await saveDB(dbPath, db);
  return db.todos[todoIndex];
};

export const deleteTodo = async (dbPath: string | URL, id: number): Promise<void> => {
  const db = await getDB(dbPath);
  const todoIndex = db.todos.findIndex(t => t.id === id);
  if (todoIndex === -1) {
    throw new Error(`Todo not found with id ${id}`);
  }

  // Remove references from team's todos array
  db.teams.forEach(team => {
    team.todos = team.todos.filter(t => t.id !== id);
  });

  db.todos.splice(todoIndex, 1);
  await saveDB(dbPath, db);
};

// Helper to assign a user to a todo
export const assignUserToTodo = async (
  dbPath: string | URL,
  todoId: number,
  userId: number
): Promise<void> => {
  const db = await getDB(dbPath);
  const todo = db.todos.find(t => t.id === todoId);
  if (!todo) throw new Error(`Todo not found with id ${todoId}`);
  const user = db.users.find(u => u.id === userId);
  if (!user) throw new Error(`User not found with id ${userId}`);

  if (todo.assignees.some(a => a.id === userId)) {
    throw new Error(`User ${userId} is already assigned to todo ${todoId}`);
  }

  todo.assignees.push(user);
  await saveDB(dbPath, db);
};

export const unassignUserFromTodo = async (
  dbPath: string | URL,
  todoId: number,
  userId: number
): Promise<void> => {
  const db = await getDB(dbPath);
  const todo = db.todos.find(t => t.id === todoId);
  if (!todo) throw new Error(`Todo not found with id ${todoId}`);

  const assigneeIndex = todo.assignees.findIndex(a => a.id === userId);
  if (assigneeIndex === -1) {
    throw new Error(`User ${userId} is not assigned to todo ${todoId}`);
  }

  todo.assignees.splice(assigneeIndex, 1);
  await saveDB(dbPath, db);
};

// ---- CRUD for Sessions ----

export const createSession = async (
  dbPath: string | URL,
  data: Omit<Session, 'id'>
): Promise<Session> => {
  const db = await getDB(dbPath);
  const newSession: Session = {
    id: getNextId(db.sessions),
    expiresAt: data.expiresAt,
  };
  db.sessions.push(newSession);
  await saveDB(dbPath, db);
  return newSession;
};

export const getSessionById = async (dbPath: string | URL, id: number): Promise<Session> => {
  const db = await getDB(dbPath);
  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    throw new Error(`Session not found with id ${id}`);
  }
  return session;
};

export const updateSession = async (
  dbPath: string | URL,
  id: number,
  updates: Partial<Omit<Session, 'id'>>
): Promise<Session> => {
  const db = await getDB(dbPath);
  const sessionIndex = db.sessions.findIndex(s => s.id === id);
  if (sessionIndex === -1) {
    throw new Error(`Session not found with id ${id}`);
  }

  db.sessions[sessionIndex] = { ...db.sessions[sessionIndex], ...updates };
  await saveDB(dbPath, db);
  return db.sessions[sessionIndex];
};

export const deleteSession = async (dbPath: string | URL, id: number): Promise<void> => {
  const db = await getDB(dbPath);
  const sessionIndex = db.sessions.findIndex(s => s.id === id);
  if (sessionIndex === -1) {
    throw new Error(`Session not found with id ${id}`);
  }

  // Remove reference from users that have this session
  db.users.forEach(user => {
    if (user.sessionId === id) {
      user.sessionId = 0; // or throw error? design choice
    }
  });

  db.sessions.splice(sessionIndex, 1);
  await saveDB(dbPath, db);
};

// ---- CRUD for Permissions ----

export const createPermission = async (
  dbPath: string | URL,
  data: Omit<Permission, 'id'>
): Promise<Permission> => {
  const db = await getDB(dbPath);
  const newPermission: Permission = {
    id: getNextId(db.permissions),
    name: data.name,
  };
  db.permissions.push(newPermission);
  await saveDB(dbPath, db);
  return newPermission;
};

export const getPermissionById = async (dbPath: string | URL, id: number): Promise<Permission> => {
  const db = await getDB(dbPath);
  const permission = db.permissions.find(p => p.id === id);
  if (!permission) {
    throw new Error(`Permission not found with id ${id}`);
  }
  return permission;
};

export const updatePermission = async (
  dbPath: string | URL,
  id: number,
  updates: Partial<Omit<Permission, 'id'>>
): Promise<Permission> => {
  const db = await getDB(dbPath);
  const permIndex = db.permissions.findIndex(p => p.id === id);
  if (permIndex === -1) {
    throw new Error(`Permission not found with id ${id}`);
  }

  db.permissions[permIndex] = { ...db.permissions[permIndex], ...updates };
  await saveDB(dbPath, db);
  return db.permissions[permIndex];
};

export const deletePermission = async (dbPath: string | URL, id: number): Promise<void> => {
  const db = await getDB(dbPath);
  const permIndex = db.permissions.findIndex(p => p.id === id);
  if (permIndex === -1) {
    throw new Error(`Permission not found with id ${id}`);
  }

  // Remove from roles that include this permission
  db.roles.forEach(role => {
    role.permissions = role.permissions.filter(p => p.id !== id);
  });

  db.permissions.splice(permIndex, 1);
  await saveDB(dbPath, db);
};

// ---- CRUD for Roles ----

export const createRole = async (
  dbPath: string | URL,
  data: Omit<Role, 'id' | 'permissions'>
): Promise<Role> => {
  const db = await getDB(dbPath);
  const newRole: Role = {
    id: getNextId(db.roles),
    name: data.name,
    permissions: [],
  };
  db.roles.push(newRole);
  await saveDB(dbPath, db);
  return newRole;
};

export const getRoleById = async (dbPath: string | URL, id: number): Promise<Role> => {
  const db = await getDB(dbPath);
  const role = db.roles.find(r => r.id === id);
  if (!role) {
    throw new Error(`Role not found with id ${id}`);
  }
  return role;
};

export const updateRole = async (
  dbPath: string | URL,
  id: number,
  updates: Partial<Pick<Role, 'name'>>
): Promise<Role> => {
  const db = await getDB(dbPath);
  const roleIndex = db.roles.findIndex(r => r.id === id);
  if (roleIndex === -1) {
    throw new Error(`Role not found with id ${id}`);
  }

  db.roles[roleIndex] = { ...db.roles[roleIndex], ...updates };
  await saveDB(dbPath, db);
  return db.roles[roleIndex];
};

export const deleteRole = async (dbPath: string | URL, id: number): Promise<void> => {
  const db = await getDB(dbPath);
  const roleIndex = db.roles.findIndex(r => r.id === id);
  if (roleIndex === -1) {
    throw new Error(`Role not found with id ${id}`);
  }

  // No other entities reference roles directly in our schema, so just delete.
  db.roles.splice(roleIndex, 1);
  await saveDB(dbPath, db);
};

// Helper to add a permission to a role
export const addPermissionToRole = async (
  dbPath: string | URL,
  roleId: number,
  permissionId: number
): Promise<void> => {
  const db = await getDB(dbPath);
  const role = db.roles.find(r => r.id === roleId);
  if (!role) throw new Error(`Role not found with id ${roleId}`);
  const perm = db.permissions.find(p => p.id === permissionId);
  if (!perm) throw new Error(`Permission not found with id ${permissionId}`);

  if (role.permissions.some(p => p.id === permissionId)) {
    throw new Error(`Permission ${permissionId} already exists in role ${roleId}`);
  }

  role.permissions.push(perm);
  await saveDB(dbPath, db);
};

export const removePermissionFromRole = async (
  dbPath: string | URL,
  roleId: number,
  permissionId: number
): Promise<void> => {
  const db = await getDB(dbPath);
  const role = db.roles.find(r => r.id === roleId);
  if (!role) throw new Error(`Role not found with id ${roleId}`);

  const permIndex = role.permissions.findIndex(p => p.id === permissionId);
  if (permIndex === -1) {
    throw new Error(`Permission ${permissionId} is not assigned to role ${roleId}`);
  }

  role.permissions.splice(permIndex, 1);
  await saveDB(dbPath, db);
};
