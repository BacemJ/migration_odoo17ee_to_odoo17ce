import { NextResponse } from 'next/server';
import { testConnectionBeforeSave } from '@/lib/database/credential-manager';

/**
 * POST /api/connections/test
 * Test a database connection without saving
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { host, port, database, username, password } = body;

    // Validate required fields
    if (!host || !port || !database || !username || !password) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Test connection
    const result = await testConnectionBeforeSave({
      host,
      port: parseInt(port),
      database,
      username,
      password,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test connection',
      },
      { status: 500 }
    );
  }
}
