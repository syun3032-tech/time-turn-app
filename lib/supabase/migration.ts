import { supabase } from './client'
import { getTaskTree as getLocalTaskTree } from '../task-tree-storage'
import { TaskNode } from '@/types/task-tree'
import { createGoal, createProject, createMilestone, createTask, createMicroTask } from './tasks'
import { saveChatMessage } from './chat'

/**
 * localStorageからSupabaseへタスクツリーを移行
 */
export async function migrateTaskTreeToSupabase(userId: string) {
  // localStorageからデータ取得
  const localTree = getLocalTaskTree()

  if (localTree.length === 0) {
    return { success: true, message: '移行するデータがありません' }
  }

  try {
    for (const node of localTree) {
      if (node.type === 'Goal') {
        // Goalを作成
        const goal = await createGoal(userId, {
          title: node.title,
          description: node.description,
          start_date: node.startDate,
          end_date: node.endDate,
        })

        // 子ノード（Projects）を処理
        if (node.children) {
          for (const projectNode of node.children) {
            if (projectNode.type === 'Project') {
              const project = await createProject(userId, {
                goal_id: goal.id,
                title: projectNode.title,
                description: projectNode.description,
                start_date: projectNode.startDate,
                end_date: projectNode.endDate,
              })

              // 子ノード（Milestones）を処理
              if (projectNode.children) {
                for (const milestoneNode of projectNode.children) {
                  if (milestoneNode.type === 'Milestone') {
                    const milestone = await createMilestone(userId, {
                      project_id: project.id,
                      title: milestoneNode.title,
                      description: milestoneNode.description,
                    })

                    // 子ノード（Tasks）を処理
                    if (milestoneNode.children) {
                      for (const taskNode of milestoneNode.children) {
                        if (taskNode.type === 'Task') {
                          const task = await createTask(userId, {
                            milestone_id: milestone.id,
                            title: taskNode.title,
                            description: taskNode.description,
                          })

                          // 子ノード（MicroTasks）を処理
                          if (taskNode.children) {
                            for (const microTaskNode of taskNode.children) {
                              if (microTaskNode.type === 'MicroTask') {
                                await createMicroTask(userId, {
                                  task_id: task.id,
                                  title: microTaskNode.title,
                                  description: microTaskNode.description,
                                })
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return { success: true, message: 'タスクツリーの移行が完了しました' }
  } catch (error) {
    console.error('Migration error:', error)
    return { success: false, message: '移行中にエラーが発生しました', error }
  }
}

/**
 * localStorageからSupabaseへ会話履歴を移行
 */
export async function migrateChatHistoryToSupabase(userId: string) {
  try {
    const chatHistory = localStorage.getItem('chatHistory')
    if (!chatHistory) {
      return { success: true, message: '移行する会話履歴がありません' }
    }

    const messages = JSON.parse(chatHistory)

    for (const msg of messages) {
      await saveChatMessage(userId, msg.role, msg.content)
    }

    return { success: true, message: '会話履歴の移行が完了しました' }
  } catch (error) {
    console.error('Chat migration error:', error)
    return { success: false, message: '会話履歴の移行中にエラーが発生しました', error }
  }
}

/**
 * 全データをlocalStorageからSupabaseへ移行
 */
export async function migrateAllData(userId: string) {
  const taskResult = await migrateTaskTreeToSupabase(userId)
  const chatResult = await migrateChatHistoryToSupabase(userId)

  return {
    taskTree: taskResult,
    chatHistory: chatResult,
    allSuccess: taskResult.success && chatResult.success
  }
}
