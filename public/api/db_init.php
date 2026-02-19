<?php
/**
 * SPLARO AUTOMATIC DATABASE INITIALIZER
 * This script will automatically sync the schema.sql to your Hostinger database.
 */

require_once 'config.php';

try {
    $db = get_db_connection();
    $sql = file_get_contents('schema.sql');

    // Split SQL into individual queries (basic splitting by semicolon)
    // Note: This is a simple parser, might need adjustment for complex triggers
    $queries = explode(';', $sql);

    $success_count = 0;
    $error_count = 0;

    foreach ($queries as $query) {
        $query = trim($query);
        if (!empty($query)) {
            try {
                $db->exec($query);
                $success_count++;
            } catch (PDOException $e) {
                // Log error but continue
                $error_count++;
            }
        }
    }

    echo json_encode([
        "status" => "success",
        "message" => "DATABASE_INITIALIZATION_COMPLETE",
        "executed_queries" => $success_count,
        "errors" => $error_count,
        "instruction" => "PLEASE DELETE THIS FILE (db_init.php) FROM THE SERVER IMMEDIATELY FOR SECURITY."
    ]);

} catch (Exception $e) {
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
