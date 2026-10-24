
namespace DudeClothing.Api.Models;

public class Carts
{
    public int CartId { get; set; }

    public int UserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public List<CartItem> Items { get; set; } = new();

    public int TotalItems => Items.Sum(item => item.Quantity);

    public decimal Subtotal =>
        Items.Sum(item => item.LineTotal);
}
