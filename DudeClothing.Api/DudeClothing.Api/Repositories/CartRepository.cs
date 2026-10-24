
using DudeClothing.Api.Data;
using DudeClothing.Api.Models;
using Microsoft.Data.SqlClient;
using System.Data;

namespace DudeClothing.Api.Repositories;

public class CartRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public CartRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    // Get the customer's cart, creating one if it does not exist.
    public async Task<Carts> GetCartAsync(int userId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        int cartId = await GetOrCreateCartIdAsync(connection, userId);

        const string cartSql = """
            SELECT CartId, UserId, CreatedAt, UpdatedAt
            FROM dbo.Carts
            WHERE CartId = @CartId;
            """;

        var cart = new Carts();

        await using (var command = new SqlCommand(cartSql, connection))
        {
            command.Parameters.Add("@CartId", SqlDbType.Int).Value = cartId;

            await using var reader = await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new InvalidOperationException("Cart not found.");

            cart.CartId = reader.GetInt32(0);
            cart.UserId = reader.GetInt32(1);
            cart.CreatedAt = reader.GetDateTime(2);
            cart.UpdatedAt = reader.IsDBNull(3)
                ? null
                : reader.GetDateTime(3);
        }

        const string itemsSql = """
            SELECT
                ci.CartItemId,
                ci.CartId,
                pv.VariantId,
                p.ProductId,
                p.ProductName,
                pv.SKU,
                pv.Size,
                pv.Colour,
                p.Price,
                ci.Quantity,
                pv.StockQuantity,
                img.ImageUrl,
                ci.AddedAt,
                ci.UpdatedAt
            FROM dbo.CartItems AS ci
            INNER JOIN dbo.ProductVariants AS pv
                ON pv.VariantId = ci.VariantId
            INNER JOIN dbo.Products AS p
                ON p.ProductId = pv.ProductId
            OUTER APPLY
            (
                SELECT TOP (1) pi.ImageUrl
                FROM dbo.ProductImages AS pi
                WHERE pi.ProductId = p.ProductId
                ORDER BY pi.IsPrimary DESC, pi.SortOrder ASC, pi.ImageId ASC
            ) AS img
            WHERE ci.CartId = @CartId
            ORDER BY ci.AddedAt DESC, ci.CartItemId DESC;
            """;

        await using (var command = new SqlCommand(itemsSql, connection))
        {
            command.Parameters.Add("@CartId", SqlDbType.Int).Value = cartId;

            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                cart.Items.Add(new CartItem
                {
                    CartItemId = reader.GetInt32(0),
                    CartId = reader.GetInt32(1),
                    VariantId = reader.GetInt32(2),
                    ProductId = reader.GetInt32(3),
                    ProductName = reader.GetString(4),
                    SKU = reader.GetString(5),
                    Size = reader.GetString(6),
                    Colour = reader.GetString(7),
                    UnitPrice = reader.GetDecimal(8),
                    Quantity = reader.GetInt32(9),
                    StockQuantity = reader.GetInt32(10),
                    ImageUrl = reader.IsDBNull(11)
                        ? null
                        : reader.GetString(11),
                    AddedAt = reader.GetDateTime(12),
                    UpdatedAt = reader.IsDBNull(13)
                        ? null
                        : reader.GetDateTime(13)
                });
            }
        }

        return cart;
    }

    // Add a variant to the cart or increase its existing quantity.
    public async Task<Carts> AddItemAsync(
        int userId,
        int variantId,
        int quantity)
    {
        if (quantity < 1 || quantity > 100)
            throw new ArgumentException(
                "Quantity must be between 1 and 100.");

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            const string variantSql = """
                SELECT pv.StockQuantity
                FROM dbo.ProductVariants AS pv WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN dbo.Products AS p
                    ON p.ProductId = pv.ProductId
                WHERE pv.VariantId = @VariantId
                  AND pv.IsActive = 1
                  AND p.IsActive = 1;
                """;

            int stock;

            await using (var command = new SqlCommand(
                variantSql, connection, transaction))
            {
                command.Parameters.Add("@VariantId", SqlDbType.Int)
                    .Value = variantId;

                var result = await command.ExecuteScalarAsync();

                if (result is null || result == DBNull.Value)
                    throw new ArgumentException(
                        "Product variant was not found or is inactive.");

                stock = Convert.ToInt32(result);
            }

            if (stock < 1)
                throw new InvalidOperationException(
                    "This product variant is out of stock.");

            int cartId = await GetOrCreateCartIdAsync(
                connection, userId, transaction);

            const string existingSql = """
                SELECT Quantity
                FROM dbo.CartItems WITH (UPDLOCK, HOLDLOCK)
                WHERE CartId = @CartId AND VariantId = @VariantId;
                """;

            int existingQuantity = 0;

            await using (var command = new SqlCommand(
                existingSql, connection, transaction))
            {
                command.Parameters.Add("@CartId", SqlDbType.Int).Value = cartId;
                command.Parameters.Add("@VariantId", SqlDbType.Int).Value =
                    variantId;

                var result = await command.ExecuteScalarAsync();

                if (result is not null && result != DBNull.Value)
                    existingQuantity = Convert.ToInt32(result);
            }

            int newQuantity = existingQuantity + quantity;

            if (newQuantity > 100)
                throw new ArgumentException(
                    "A cart item cannot exceed 100 units.");

            if (newQuantity > stock)
                throw new InvalidOperationException(
                    $"Only {stock} unit(s) are currently in stock.");

            if (existingQuantity > 0)
            {
                const string updateSql = """
                    UPDATE dbo.CartItems
                    SET Quantity = @Quantity,
                        UpdatedAt = SYSUTCDATETIME()
                    WHERE CartId = @CartId AND VariantId = @VariantId;
                    """;

                await using var command = new SqlCommand(
                    updateSql, connection, transaction);

                command.Parameters.Add("@Quantity", SqlDbType.Int)
                    .Value = newQuantity;
                command.Parameters.Add("@CartId", SqlDbType.Int).Value = cartId;
                command.Parameters.Add("@VariantId", SqlDbType.Int)
                    .Value = variantId;

                await command.ExecuteNonQueryAsync();
            }
            else
            {
                const string insertSql = """
                    INSERT INTO dbo.CartItems
                        (CartId, VariantId, Quantity)
                    VALUES
                        (@CartId, @VariantId, @Quantity);
                    """;

                await using var command = new SqlCommand(
                    insertSql, connection, transaction);

                command.Parameters.Add("@CartId", SqlDbType.Int).Value = cartId;
                command.Parameters.Add("@VariantId", SqlDbType.Int)
                    .Value = variantId;
                command.Parameters.Add("@Quantity", SqlDbType.Int)
                    .Value = quantity;

                await command.ExecuteNonQueryAsync();
            }

            const string updateCartSql = """
                UPDATE dbo.Carts
                SET UpdatedAt = SYSUTCDATETIME()
                WHERE CartId = @CartId;
                """;

            await using (var command = new SqlCommand(
                updateCartSql, connection, transaction))
            {
                command.Parameters.Add("@CartId", SqlDbType.Int).Value = cartId;
                await command.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return await GetCartAsync(userId);
    }

    // Change the quantity of an item already in the cart.
    public async Task<Carts?> UpdateItemQuantityAsync(
        int userId,
        int cartItemId,
        int quantity)
    {
        if (quantity < 1 || quantity > 100)
            throw new ArgumentException(
                "Quantity must be between 1 and 100.");

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            const string updateSql = """
                UPDATE ci
                SET ci.Quantity = @Quantity,
                    ci.UpdatedAt = SYSUTCDATETIME()
                FROM dbo.CartItems AS ci
                INNER JOIN dbo.Carts AS c
                    ON c.CartId = ci.CartId
                INNER JOIN dbo.ProductVariants AS pv
                    ON pv.VariantId = ci.VariantId
                INNER JOIN dbo.Products AS p
                    ON p.ProductId = pv.ProductId
                WHERE ci.CartItemId = @CartItemId
                  AND c.UserId = @UserId
                  AND pv.IsActive = 1
                  AND p.IsActive = 1
                  AND pv.StockQuantity >= @Quantity;
                """;

            int rowsAffected;

            await using (var command = new SqlCommand(
                updateSql, connection, transaction))
            {
                command.Parameters.Add("@Quantity", SqlDbType.Int).Value =
                    quantity;
                command.Parameters.Add("@CartItemId", SqlDbType.Int).Value =
                    cartItemId;
                command.Parameters.Add("@UserId", SqlDbType.Int).Value = userId;

                rowsAffected = await command.ExecuteNonQueryAsync();
            }

            if (rowsAffected == 0)
            {
                const string existsSql = """
                    SELECT COUNT(*)
                    FROM dbo.CartItems AS ci
                    INNER JOIN dbo.Carts AS c ON c.CartId = ci.CartId
                    WHERE ci.CartItemId = @CartItemId
                      AND c.UserId = @UserId;
                    """;

                await using var command = new SqlCommand(
                    existsSql, connection, transaction);

                command.Parameters.Add("@CartItemId", SqlDbType.Int)
                    .Value = cartItemId;
                command.Parameters.Add("@UserId", SqlDbType.Int).Value = userId;

                int exists = Convert.ToInt32(
                    await command.ExecuteScalarAsync());

                if (exists == 0)
                {
                    await transaction.CommitAsync();
                    return null;
                }

                throw new InvalidOperationException(
                    "The product is inactive or there is not enough stock.");
            }

            const string updateCartSql = """
                UPDATE c
                SET UpdatedAt = SYSUTCDATETIME()
                FROM dbo.Carts AS c
                INNER JOIN dbo.CartItems AS ci ON ci.CartId = c.CartId
                WHERE ci.CartItemId = @CartItemId
                  AND c.UserId = @UserId;
                """;

            await using (var command = new SqlCommand(
                updateCartSql, connection, transaction))
            {
                command.Parameters.Add("@CartItemId", SqlDbType.Int)
                    .Value = cartItemId;
                command.Parameters.Add("@UserId", SqlDbType.Int).Value = userId;
                await command.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return await GetCartAsync(userId);
    }

    // Remove one item belonging to this customer.
    public async Task<bool> RemoveItemAsync(int userId, int cartItemId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string sql = """
            DELETE ci
            FROM dbo.CartItems AS ci
            INNER JOIN dbo.Carts AS c ON c.CartId = ci.CartId
            WHERE ci.CartItemId = @CartItemId
              AND c.UserId = @UserId;
            """;

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@CartItemId", SqlDbType.Int).Value = cartItemId;
        command.Parameters.Add("@UserId", SqlDbType.Int).Value = userId;

        bool removed = await command.ExecuteNonQueryAsync() > 0;

        if (removed)
        {
            const string updateCartSql = """
                UPDATE dbo.Carts
                SET UpdatedAt = SYSUTCDATETIME()
                WHERE UserId = @UserId;
                """;

            await using var updateCommand =
                new SqlCommand(updateCartSql, connection);

            updateCommand.Parameters.Add("@UserId", SqlDbType.Int).Value =
                userId;

            await updateCommand.ExecuteNonQueryAsync();
        }

        return removed;
    }

    // Remove all items from this customer's cart.
    public async Task ClearCartAsync(int userId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        const string sql = """
            DELETE ci
            FROM dbo.CartItems AS ci
            INNER JOIN dbo.Carts AS c ON c.CartId = ci.CartId
            WHERE c.UserId = @UserId;

            UPDATE dbo.Carts
            SET UpdatedAt = SYSUTCDATETIME()
            WHERE UserId = @UserId;
            """;

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@UserId", SqlDbType.Int).Value = userId;

        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> GetOrCreateCartIdAsync(
        SqlConnection connection,
        int userId,
        SqlTransaction? transaction = null)
    {
        const string sql = """
            IF NOT EXISTS
            (
                SELECT 1
                FROM dbo.Carts WITH (UPDLOCK, HOLDLOCK)
                WHERE UserId = @UserId
            )
            BEGIN
                INSERT INTO dbo.Carts (UserId)
                VALUES (@UserId);
            END;

            SELECT CartId
            FROM dbo.Carts
            WHERE UserId = @UserId;
            """;

        await using var command = new SqlCommand(sql, connection, transaction);

        command.Parameters.Add("@UserId", SqlDbType.Int).Value = userId;

        var result = await command.ExecuteScalarAsync();

        if (result is null || result == DBNull.Value)
            throw new InvalidOperationException(
                "Unable to create or retrieve the customer's cart.");

        return Convert.ToInt32(result);
    }
}
