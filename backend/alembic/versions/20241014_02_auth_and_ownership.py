from alembic import op
import sqlalchemy as sa


revision = '20241014_02'
down_revision = '20241014_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if 'users' not in tables:
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=320), nullable=False),
            sa.Column('password_hash', sa.String(length=512), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )
    user_indexes = {index['name'] for index in sa.inspect(op.get_bind()).get_indexes('users')}
    if 'ix_users_id' not in user_indexes:
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    if 'ix_users_email' not in user_indexes:
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    if 'auth_sessions' not in tables:
        op.create_table(
            'auth_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('revoked_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
    session_indexes = {index['name'] for index in sa.inspect(op.get_bind()).get_indexes('auth_sessions')}
    for index_name, columns, unique in (
        ('ix_auth_sessions_id', ['id'], False),
        ('ix_auth_sessions_user_id', ['user_id'], False),
        ('ix_auth_sessions_token_hash', ['token_hash'], True),
    ):
        if index_name not in session_indexes:
            op.create_index(index_name, 'auth_sessions', columns, unique=unique)

    evaluation_columns = {column['name'] for column in sa.inspect(op.get_bind()).get_columns('evaluations')}
    if 'user_id' not in evaluation_columns:
        op.add_column('evaluations', sa.Column('user_id', sa.Integer(), nullable=True))
    evaluation_indexes = {index['name'] for index in sa.inspect(op.get_bind()).get_indexes('evaluations')}
    if 'ix_evaluations_user_id' not in evaluation_indexes:
        op.create_index(op.f('ix_evaluations_user_id'), 'evaluations', ['user_id'], unique=False)
    foreign_keys = {foreign_key.get('name') for foreign_key in sa.inspect(op.get_bind()).get_foreign_keys('evaluations')}
    if 'fk_evaluations_user_id_users' not in foreign_keys:
        if op.get_bind().dialect.name == 'sqlite':
            with op.batch_alter_table('evaluations', recreate='always') as batch:
                batch.create_foreign_key(
                    'fk_evaluations_user_id_users',
                    'users',
                    ['user_id'],
                    ['id'],
                    ondelete='SET NULL',
                )
        else:
            op.create_foreign_key(
                'fk_evaluations_user_id_users',
                'evaluations',
                'users',
                ['user_id'],
                ['id'],
                ondelete='SET NULL',
            )


def downgrade() -> None:
    op.drop_constraint('fk_evaluations_user_id_users', 'evaluations', type_='foreignkey')
    op.drop_index(op.f('ix_evaluations_user_id'), table_name='evaluations')
    op.drop_column('evaluations', 'user_id')
    op.drop_index(op.f('ix_auth_sessions_token_hash'), table_name='auth_sessions')
    op.drop_index(op.f('ix_auth_sessions_user_id'), table_name='auth_sessions')
    op.drop_index(op.f('ix_auth_sessions_id'), table_name='auth_sessions')
    op.drop_table('auth_sessions')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
