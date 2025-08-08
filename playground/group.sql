INSERT INTO gl_group_line_items (
    uuid,
    posting_date,
    group_id,
    gl_account_id,
    amount,
    fee_type,
    fee_category,
    posted,
    contra,
    contra_reference
)
SELECT
    gen_random_uuid() AS uuid,
    NOW() AS posting_date,
    net.group_id,
    net.gl_account_id,
    net.total_amount AS amount,
    CASE 
        WHEN net.logical_account = 'claimoutstanding' THEN '400401-GL(Reserve Acct)'
        WHEN net.logical_account = 'claimexpense' THEN '400401(Expense)'
    END AS fee_type,
    CASE 
        WHEN net.total_amount >= 0 THEN '1'
        ELSE '2'
    END AS fee_category,
    'N'::varchar AS posted,
    'N'::varchar AS contra,
    NULL::uuid AS contra_reference
FROM (
    SELECT 
        group_id,
        gl_account_id,
        logical_account,
        group_config_id,
        SUM(
            CASE
                WHEN posting_nature = 'credit' AND logical_account = 'claimoutstanding' THEN amount
                WHEN posting_nature = 'debit' AND logical_account = 'claimoutstanding' THEN -amount
                WHEN posting_nature = 'debit' AND logical_account = 'claimexpense' THEN amount
                WHEN posting_nature = 'credit' AND logical_account = 'claimexpense' THEN -amount
                ELSE 0
            END
        ) AS total_amount
    FROM 
        claim_gl_line_items li
    JOIN 
        gl_account ga ON li.gl_account_id = ga.uuid
    WHERE 
        li.processed = 'N'
        AND ga.logical_account IN ('claimoutstanding', 'claimexpense')
    GROUP BY 
        group_id, gl_account_id, ga.logical_account
) AS net
LIMIT 1;