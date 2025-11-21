import { NextResponse } from 'next/server';
import {
  saveConnection,
  getAllConnections,
  deleteConnection,
  testConnectionBeforeSave,
} from '@/lib/database/credential-manager';

/**
 * GET /api/connections
 * Get all database connections
 */
export async function GET() {
  try {
    const connections = await getAllConnections();
    return NextResponse.json({ success: true, data: connections });
  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch connections',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections
 * Create or update a database connection
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, host, port, database, username, password, role } = body;

    // Validate required fields
    if (!name || !host || !port || !database || !username || !password || !role) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['source_ee', 'staging', 'target_ce'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Test connection first
    const testResult = await testConnectionBeforeSave({
      host,
      port: parseInt(port),
      database,
      username,
      password,
    });

    if (!testResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Connection test failed: ${testResult.message}`,
        },
        { status: 400 }
      );
    }

    // Save (create or upsert-by-name / update-by-id) connection
    const connection = await saveConnection({
      id: id ? parseInt(id) : undefined,
      name,
      host,
      port: parseInt(port),
      database,
      username,
      password,
      role,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...connection,
        serverVersion: testResult.serverVersion,
      },
      message: id ? 'Connection updated successfully' : (connection ? 'Connection upserted successfully (by name)' : 'Connection created successfully'),
    });
  } catch (error) {
    console.error('Error saving connection:', error);
    // Friendly duplicate handling (should be covered by upsert, but fallback if error surfaces)
    if (error instanceof Error && /duplicate key value violates unique constraint/.test(error.message)) {
      return NextResponse.json(
        { success: false, error: 'A connection with this name already exists. It was not updated because an ID was not supplied.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save connection',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections?id=<id>
 * Delete a database connection
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteConnection(parseInt(id));

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete connection',
      },
      { status: 500 }
    );
  }
}
