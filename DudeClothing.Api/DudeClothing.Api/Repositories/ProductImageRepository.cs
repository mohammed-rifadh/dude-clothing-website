
using System.Data;
using DudeClothing.Api.Data;
using DudeClothing.Api.Models;
using Microsoft.Data.SqlClient;

namespace DudeClothing.Api.Repositories;

public sealed class ProductImageRepository
{
    private readonly DbConnectionFactory _connectionFactory;

    public ProductImageRepository(DbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<List<ProductImage>> GetAllAsync()
    {
        const string sql = """
            SELECT
                i.ImageId,
                i.ProductId,
                p.ProductName,
                i.ImageUrl,
                i.AltText,
                i.IsPrimary,
                i.SortOrder,
                i.CreatedAt
            FROM dbo.ProductImages AS i
            INNER JOIN dbo.Products AS p
                ON p.ProductId = i.ProductId
            WHERE p.IsActive = 1
            ORDER BY p.ProductName, i.SortOrder, i.ImageId;
            """;

        var images = new List<ProductImage>();

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            images.Add(MapImage(reader));
        }

        return images;
    }

    public async Task<ProductImage?> GetByIdAsync(int imageId)
    {
        const string sql = """
            SELECT
                i.ImageId,
                i.ProductId,
                p.ProductName,
                i.ImageUrl,
                i.AltText,
                i.IsPrimary,
                i.SortOrder,
                i.CreatedAt
            FROM dbo.ProductImages AS i
            INNER JOIN dbo.Products AS p
                ON p.ProductId = i.ProductId
            WHERE i.ImageId = @ImageId
              AND p.IsActive = 1;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@ImageId", SqlDbType.Int).Value = imageId;

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return null;
        }

        return MapImage(reader);
    }

    public async Task<List<ProductImage>> GetByProductIdAsync(int productId)
    {
        const string sql = """
            SELECT
                i.ImageId,
                i.ProductId,
                p.ProductName,
                i.ImageUrl,
                i.AltText,
                i.IsPrimary,
                i.SortOrder,
                i.CreatedAt
            FROM dbo.ProductImages AS i
            INNER JOIN dbo.Products AS p
                ON p.ProductId = i.ProductId
            WHERE i.ProductId = @ProductId
              AND p.IsActive = 1
            ORDER BY i.SortOrder, i.ImageId;
            """;

        var images = new List<ProductImage>();

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@ProductId", SqlDbType.Int).Value = productId;

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            images.Add(MapImage(reader));
        }

        return images;
    }

    public async Task<bool> ProductExistsAsync(int productId)
    {
        const string sql = """
            SELECT CASE WHEN EXISTS
            (
                SELECT 1
                FROM dbo.Products
                WHERE ProductId = @ProductId
                  AND IsActive = 1
            )
            THEN 1 ELSE 0 END;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.Add("@ProductId", SqlDbType.Int).Value = productId;

        var result = await command.ExecuteScalarAsync();

        return Convert.ToInt32(result) == 1;
    }

    public async Task<int> CreateAsync(ProductImageWriteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        const string insertSql = """
            INSERT INTO dbo.ProductImages
            (
                ProductId,
                ImageUrl,
                AltText,
                IsPrimary,
                SortOrder,
                CreatedAt
            )
            OUTPUT INSERTED.ImageId
            VALUES
            (
                @ProductId,
                @ImageUrl,
                @AltText,
                @IsPrimary,
                @SortOrder,
                SYSDATETIME()
            );
            """;

        const string nextSortOrderSql = """
            SELECT COALESCE(MAX(SortOrder), 0) + 1
            FROM dbo.ProductImages WITH (UPDLOCK, HOLDLOCK)
            WHERE ProductId = @ProductId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            var sortOrder = request.SortOrder;

            // The database constraint requires SortOrder >= 1.
            // If no valid order was supplied, use the next order
            // for this product.
            if (sortOrder < 1)
            {
                await using var sortCommand = new SqlCommand(
                    nextSortOrderSql,
                    connection,
                    transaction);

                sortCommand.Parameters.Add("@ProductId", SqlDbType.Int).Value =
                    request.ProductId;

                sortOrder = Convert.ToInt32(
                    await sortCommand.ExecuteScalarAsync());
            }

            if (request.IsPrimary)
            {
                const string clearPrimarySql = """
                    UPDATE dbo.ProductImages
                    SET IsPrimary = 0
                    WHERE ProductId = @ProductId;
                    """;

                await using var clearCommand = new SqlCommand(
                    clearPrimarySql,
                    connection,
                    transaction);

                clearCommand.Parameters.Add("@ProductId", SqlDbType.Int).Value =
                    request.ProductId;

                await clearCommand.ExecuteNonQueryAsync();
            }

            await using var insertCommand = new SqlCommand(
                insertSql,
                connection,
                transaction);

            AddWriteParameters(insertCommand, request, sortOrder);

            var result = await insertCommand.ExecuteScalarAsync();
            var imageId = Convert.ToInt32(result);

            await transaction.CommitAsync();

            return imageId;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> UpdateAsync(
        int imageId,
        ProductImageUpdateRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.SortOrder < 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(request.SortOrder),
                "SortOrder must be greater than or equal to 1.");
        }

        const string sql = """
            UPDATE dbo.ProductImages
            SET
                ImageUrl = @ImageUrl,
                AltText = @AltText,
                SortOrder = @SortOrder
            WHERE ImageId = @ImageId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@ImageId", SqlDbType.Int).Value = imageId;
        AddUpdateParameters(command, request);

        return await command.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> SetPrimaryAsync(int imageId)
    {
        const string findSql = """
            SELECT i.ProductId
            FROM dbo.ProductImages AS i WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Products AS p
                ON p.ProductId = i.ProductId
            WHERE i.ImageId = @ImageId
              AND p.IsActive = 1;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            int productId;

            await using (var findCommand = new SqlCommand(
                findSql,
                connection,
                transaction))
            {
                findCommand.Parameters.Add("@ImageId", SqlDbType.Int).Value =
                    imageId;

                var result = await findCommand.ExecuteScalarAsync();

                if (result is null || result == DBNull.Value)
                {
                    await transaction.RollbackAsync();
                    return false;
                }

                productId = Convert.ToInt32(result);
            }

            const string clearSql = """
                UPDATE dbo.ProductImages
                SET IsPrimary = 0
                WHERE ProductId = @ProductId;
                """;

            await using (var clearCommand = new SqlCommand(
                clearSql,
                connection,
                transaction))
            {
                clearCommand.Parameters.Add("@ProductId", SqlDbType.Int).Value =
                    productId;

                await clearCommand.ExecuteNonQueryAsync();
            }

            const string setSql = """
                UPDATE dbo.ProductImages
                SET IsPrimary = 1
                WHERE ImageId = @ImageId;
                """;

            await using (var setCommand = new SqlCommand(
                setSql,
                connection,
                transaction))
            {
                setCommand.Parameters.Add("@ImageId", SqlDbType.Int).Value =
                    imageId;

                await setCommand.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();

            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> UpdateSortOrderAsync(
        int imageId,
        int sortOrder)
    {
        if (sortOrder < 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(sortOrder),
                "SortOrder must be greater than or equal to 1.");
        }

        const string sql = """
            UPDATE dbo.ProductImages
            SET SortOrder = @SortOrder
            WHERE ImageId = @ImageId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var command = new SqlCommand(sql, connection);

        command.Parameters.Add("@ImageId", SqlDbType.Int).Value = imageId;
        command.Parameters.Add("@SortOrder", SqlDbType.Int).Value = sortOrder;

        return await command.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> DeleteAsync(int imageId)
    {
        const string findSql = """
            SELECT ProductId, IsPrimary
            FROM dbo.ProductImages WITH (UPDLOCK, HOLDLOCK)
            WHERE ImageId = @ImageId;
            """;

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync(
                IsolationLevel.Serializable);

        try
        {
            int productId;
            bool wasPrimary;

            await using (var findCommand = new SqlCommand(
                findSql,
                connection,
                transaction))
            {
                findCommand.Parameters.Add("@ImageId", SqlDbType.Int).Value =
                    imageId;

                await using var reader =
                    await findCommand.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    await reader.CloseAsync();
                    await transaction.RollbackAsync();
                    return false;
                }

                productId = reader.GetInt32(0);
                wasPrimary = reader.GetBoolean(1);

                await reader.CloseAsync();
            }

            const string deleteSql = """
                DELETE FROM dbo.ProductImages
                WHERE ImageId = @ImageId;
                """;

            await using (var deleteCommand = new SqlCommand(
                deleteSql,
                connection,
                transaction))
            {
                deleteCommand.Parameters.Add("@ImageId", SqlDbType.Int).Value =
                    imageId;

                await deleteCommand.ExecuteNonQueryAsync();
            }

            if (wasPrimary)
            {
                const string nextImageSql = """
                    SELECT TOP (1) ImageId
                    FROM dbo.ProductImages
                    WHERE ProductId = @ProductId
                    ORDER BY SortOrder, ImageId;
                    """;

                object? nextImageId;

                await using (var nextCommand = new SqlCommand(
                    nextImageSql,
                    connection,
                    transaction))
                {
                    nextCommand.Parameters.Add(
                        "@ProductId",
                        SqlDbType.Int).Value = productId;

                    nextImageId = await nextCommand.ExecuteScalarAsync();
                }

                if (nextImageId is not null &&
                    nextImageId != DBNull.Value)
                {
                    const string setNextSql = """
                        UPDATE dbo.ProductImages
                        SET IsPrimary = 1
                        WHERE ImageId = @ImageId;
                        """;

                    await using var setNextCommand = new SqlCommand(
                        setNextSql,
                        connection,
                        transaction);

                    setNextCommand.Parameters.Add(
                        "@ImageId",
                        SqlDbType.Int).Value =
                        Convert.ToInt32(nextImageId);

                    await setNextCommand.ExecuteNonQueryAsync();
                }
            }

            await transaction.CommitAsync();

            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static void AddWriteParameters(
        SqlCommand command,
        ProductImageWriteRequest request,
        int sortOrder)
    {
        command.Parameters.Add("@ProductId", SqlDbType.Int).Value =
            request.ProductId;

        command.Parameters.Add("@ImageUrl", SqlDbType.NVarChar, 1000).Value =
            request.ImageUrl.Trim();

        command.Parameters.Add("@AltText", SqlDbType.NVarChar, 250).Value =
            string.IsNullOrWhiteSpace(request.AltText)
                ? DBNull.Value
                : request.AltText.Trim();

        command.Parameters.Add("@IsPrimary", SqlDbType.Bit).Value =
            request.IsPrimary;

        command.Parameters.Add("@SortOrder", SqlDbType.Int).Value =
            sortOrder;
    }

    private static void AddUpdateParameters(
        SqlCommand command,
        ProductImageUpdateRequest request)
    {
        command.Parameters.Add("@ImageUrl", SqlDbType.NVarChar, 1000).Value =
            request.ImageUrl.Trim();

        command.Parameters.Add("@AltText", SqlDbType.NVarChar, 250).Value =
            string.IsNullOrWhiteSpace(request.AltText)
                ? DBNull.Value
                : request.AltText.Trim();

        command.Parameters.Add("@SortOrder", SqlDbType.Int).Value =
            request.SortOrder;
    }

    private static ProductImage MapImage(IDataRecord reader)
    {
        return new ProductImage
        {
            ImageId = reader.GetInt32(reader.GetOrdinal("ImageId")),
            ProductId = reader.GetInt32(reader.GetOrdinal("ProductId")),
            ProductName = reader.GetString(reader.GetOrdinal("ProductName")),
            ImageUrl = reader.GetString(reader.GetOrdinal("ImageUrl")),
            AltText = reader.IsDBNull(reader.GetOrdinal("AltText"))
                ? null
                : reader.GetString(reader.GetOrdinal("AltText")),
            IsPrimary = reader.GetBoolean(reader.GetOrdinal("IsPrimary")),
            SortOrder = reader.GetInt32(reader.GetOrdinal("SortOrder")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt"))
        };
    }
}
