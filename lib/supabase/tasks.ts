import { supabase } from './client'
import type { Database } from './database.types'

type Goal = Database['public']['Tables']['goals']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type Milestone = Database['public']['Tables']['milestones']['Row']
type Task = Database['public']['Tables']['tasks']['Row']
type MicroTask = Database['public']['Tables']['micro_tasks']['Row']

export interface TaskTreeNode {
  goal: Goal
  projects: Array<{
    project: Project
    milestones: Array<{
      milestone: Milestone
      tasks: Array<{
        task: Task
        microTasks: MicroTask[]
      }>
    }>
  }>
}

/**
 * ユーザーのタスクツリー全体を取得
 */
export async function getTaskTree(userId: string): Promise<TaskTreeNode[]> {
  // Goals取得
  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (goalsError) throw goalsError
  if (!goals) return []

  const tree: TaskTreeNode[] = []

  for (const goal of goals) {
    // Projects取得
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('goal_id', (goal as any).id)
      .order('order_index', { ascending: true })

    if (projectsError) throw projectsError

    const projectNodes = []
    for (const project of projects || []) {
      // Milestones取得
      const { data: milestones, error: milestonesError } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', (project as any).id)
        .order('order_index', { ascending: true })

      if (milestonesError) throw milestonesError

      const milestoneNodes = []
      for (const milestone of milestones || []) {
        // Tasks取得
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('milestone_id', (milestone as any).id)
          .order('order_index', { ascending: true })

        if (tasksError) throw tasksError

        const taskNodes = []
        for (const task of tasks || []) {
          // MicroTasks取得
          const { data: microTasks, error: microTasksError } = await supabase
            .from('micro_tasks')
            .select('*')
            .eq('task_id', (task as any).id)
            .order('order_index', { ascending: true })

          if (microTasksError) throw microTasksError

          taskNodes.push({
            task,
            microTasks: microTasks || []
          })
        }

        milestoneNodes.push({
          milestone,
          tasks: taskNodes
        })
      }

      projectNodes.push({
        project,
        milestones: milestoneNodes
      })
    }

    tree.push({
      goal,
      projects: projectNodes
    })
  }

  return tree
}

/**
 * Goalを作成
 */
export async function createGoal(
  userId: string,
  data: Omit<Database['public']['Tables']['goals']['Insert'], 'user_id'>
) {
  const { data: goal, error } = await supabase
    .from('goals')
    .insert({ ...data, user_id: userId } as any)
    .select()
    .single()

  if (error) throw error
  return goal as any
}

/**
 * Projectを作成
 */
export async function createProject(
  userId: string,
  data: Omit<Database['public']['Tables']['projects']['Insert'], 'user_id'>
) {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ ...data, user_id: userId } as any)
    .select()
    .single()

  if (error) throw error
  return project as any
}

/**
 * Milestoneを作成
 */
export async function createMilestone(
  userId: string,
  data: Omit<Database['public']['Tables']['milestones']['Insert'], 'user_id'>
) {
  const { data: milestone, error } = await supabase
    .from('milestones')
    .insert({ ...data, user_id: userId } as any)
    .select()
    .single()

  if (error) throw error
  return milestone as any
}

/**
 * Taskを作成
 */
export async function createTask(
  userId: string,
  data: Omit<Database['public']['Tables']['tasks']['Insert'], 'user_id'>
) {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ ...data, user_id: userId } as any)
    .select()
    .single()

  if (error) throw error
  return task as any
}

/**
 * MicroTaskを作成
 */
export async function createMicroTask(
  userId: string,
  data: Omit<Database['public']['Tables']['micro_tasks']['Insert'], 'user_id'>
) {
  const { data: microTask, error } = await supabase
    .from('micro_tasks')
    .insert({ ...data, user_id: userId } as any)
    .select()
    .single()

  if (error) throw error
  return microTask as any
}

/**
 * タスクのステータスを更新
 */
export async function updateTaskStatus(
  taskId: string,
  status: '未着手' | '進行中' | '完了' | '保留'
) {
  const { error } = await (supabase as any)
    .from('tasks')
    .update({ status })
    .eq('id', taskId)

  if (error) throw error
}

/**
 * タスクの進捗を更新
 */
export async function updateTaskProgress(taskId: string, progress: number) {
  const { error } = await (supabase as any)
    .from('tasks')
    .update({ progress })
    .eq('id', taskId)

  if (error) throw error
}
